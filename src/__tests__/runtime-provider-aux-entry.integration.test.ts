import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { stringify as stringifyYaml } from 'yaml';
import {
  resolveAuxiliaryProviderEnvironment,
  resolveAuxiliaryRuntimeEnvironment,
} from '../infra/config/runtime-provider/provider-environment.js';
import { getWorkflowDescription } from '../infra/config/loaders/workflowPreview.js';
import { resolveConfiguredExecProviderModel } from '../features/exec/runtimeConfig.js';
import { previewPrompts } from '../features/prompt/preview.js';
import { initializeSession } from '../features/interactive/sessionInitialization.js';
import { resolveWorkflowCompanions } from '../infra/config/workflowCompanionResolution.js';
import {
  getGlobalConfigDir,
  getGlobalConfigPath,
  getProjectConfigDir,
  invalidateAllResolvedConfigCache,
  invalidateGlobalConfigCache,
} from '../infra/config/index.js';
import { RUNTIME_PROVIDER_FILENAME } from '../infra/config/runtime-provider/constants.js';
import type { WorkflowConfig } from '../core/models/index.js';
import type { StepProviderOptions } from '../core/models/workflow-types.js';
import type { RuntimeProviderFile } from '../infra/config/runtime-provider/schema.js';

/**
 * Integration coverage for the shared auxiliary provider-environment entry (issue #1136, Unit B).
 * preview and doctor resolve provider/model through this single function, so it must:
 * - surface runtime.yaml `profiles.default` in a runtime-v1 environment (not legacy defaults),
 * - pass legacy config.yaml provider/model through unchanged when no active runtime section exists,
 * - fail fast when an active runtime section coexists with legacy provider settings.
 */

const WORKFLOW: Pick<WorkflowConfig, 'name'> = {
  name: 'aux-entry-workflow',
};

const COMPANION_WORKFLOW: WorkflowConfig = {
  name: 'aux-companion-workflow',
  steps: [{
    name: 'implement',
    personaDisplayName: 'coder',
    instruction: 'implement',
    passPreviousResponse: false,
    companion: { fixed: ['security-reviewer'], pool: [] },
  }],
  initialStep: 'implement',
  maxSteps: 1,
};

let projectCwd: string;

function writeGlobalConfig(lines: string[]): void {
  writeFileSync(getGlobalConfigPath(), `${lines.join('\n')}\n`);
}

function writeGlobalRuntimeFile(content: RuntimeProviderFile): void {
  writeFileSync(join(getGlobalConfigDir(), RUNTIME_PROVIDER_FILENAME), stringifyYaml(content));
}

const MIXED_CONFIG_PROVIDER_ERROR = /config\.yaml:provider.*provider\.defaults \+ provider\.profiles/s;

function activeRuntimeSection(): RuntimeProviderFile {
  return {
    version: 1,
    provider: {
      defaults: { profile: 'default' },
      profiles: { default: { provider: 'codex', model: 'gpt-runtime' } },
    },
  };
}

describe('resolveAuxiliaryProviderEnvironment', () => {
  beforeEach(() => {
    projectCwd = mkdtempSync(join(tmpdir(), 'takt-aux-entry-project-'));
    mkdirSync(getProjectConfigDir(projectCwd), { recursive: true });
    invalidateGlobalConfigCache();
    invalidateAllResolvedConfigCache();
  });

  afterEach(() => {
    rmSync(projectCwd, { recursive: true, force: true });
    invalidateGlobalConfigCache();
    invalidateAllResolvedConfigCache();
  });

  it('resolves runtime.yaml profiles.default in a runtime-v1 environment', () => {
    writeGlobalConfig(['language: en']);
    writeGlobalRuntimeFile(activeRuntimeSection());
    invalidateGlobalConfigCache();
    invalidateAllResolvedConfigCache();

    const env = resolveAuxiliaryProviderEnvironment(projectCwd, WORKFLOW);

    expect(env.provider).toBe('codex');
    expect(env.model).toBe('gpt-runtime');
    expect(env.providerSource).toBe('runtime-v1');
    expect(env.modelSource).toBe('runtime-v1');
    expect(env.tagConflictPolicy).toBe('fail-fast');
  });

  it('rejects a reachable companion in MCP-only runtime mode without a provider section', () => {
    writeGlobalConfig(['language: en', 'provider: codex', 'model: legacy-model']);
    writeGlobalRuntimeFile({
      version: 1,
      companion: { enabled: true },
      mcp: {
        servers: { docs: { type: 'stdio', command: 'docs-server' } },
        defaults: { servers: ['docs'] },
      },
    });
    invalidateGlobalConfigCache();
    invalidateAllResolvedConfigCache();

    const runtime = resolveAuxiliaryRuntimeEnvironment(projectCwd, COMPANION_WORKFLOW);

    expect(runtime.providerConfigMode).toBe('runtime-v1');
    expect(runtime.providerSectionActive).toBe(false);
    expect(runtime.providerEnvironment.provider).toBe('codex');
    expect(runtime.providerEnvironment.mcpAssignment?.defaults?.servers).toEqual(['docs']);
    expect(() => resolveWorkflowCompanions(COMPANION_WORKFLOW, runtime.providerEnvironment, {
      projectCwd,
      lookupCwd: projectCwd,
      providerConfigMode: runtime.providerConfigMode,
      providerSectionActive: runtime.providerSectionActive,
    })).toThrow(/runtime\.yaml/);
  });

  it.each(['assistant', 'non-workflow', 'companion'] as const)(
    'applies the DeepSeek reasoning effort env override to the %s runtime profile consumer',
    (consumer) => {
      writeGlobalConfig(['language: en']);
      writeGlobalRuntimeFile({
        version: 1,
        companion: { enabled: true },
        provider: {
          defaults: { profile: 'default' },
          profiles: {
            default: {
              provider: 'deepseek-harness',
              model: 'deepseek-v4-flash',
              options: { max_tokens: 4096, reasoning_effort: 'high' },
            },
            assistant: {
              provider: 'deepseek-harness',
              model: 'deepseek-v4-flash',
              options: { max_tokens: 4096, reasoning_effort: 'high' },
            },
            companion: {
              provider: 'deepseek-harness',
              model: 'deepseek-v4-flash',
              options: { max_tokens: 4096, reasoning_effort: 'high' },
            },
          },
          targets: {
            internal_agents: { assistant: { profile: 'assistant' } },
            companions: { 'security-reviewer': { profile: 'companion' } },
          },
        },
      });
      const previous = process.env.TAKT_PROVIDER_OPTIONS_DEEPSEEK_HARNESS_REASONING_EFFORT;
      process.env.TAKT_PROVIDER_OPTIONS_DEEPSEEK_HARNESS_REASONING_EFFORT = 'low';
      invalidateGlobalConfigCache();
      invalidateAllResolvedConfigCache();
      try {
        let providerOptions: StepProviderOptions | undefined;
        if (consumer === 'companion') {
          const runtime = resolveAuxiliaryRuntimeEnvironment(projectCwd, COMPANION_WORKFLOW);
          const companions = resolveWorkflowCompanions(
            COMPANION_WORKFLOW,
            runtime.providerEnvironment,
            {
              projectCwd,
              lookupCwd: projectCwd,
              providerConfigMode: runtime.providerConfigMode,
              providerSectionActive: runtime.providerSectionActive,
              providerOptionsResolution: {
                configProviderOptions: runtime.configProviderOptions,
                providerOptionsSource: runtime.providerOptionsSource,
                providerOptionsOriginResolver: runtime.providerOptionsOriginResolver,
              },
            },
          );
          providerOptions = companions.get('security-reviewer')?.providerOptions;
        } else {
          const ctx = initializeSession(
            projectCwd,
            consumer === 'assistant' ? 'interactive' : 'coder',
          );
          providerOptions = ctx.providerOptions;
        }

        expect(providerOptions).toMatchObject({
          deepseekHarness: { maxTokens: 4096, reasoningEffort: 'low' },
        });
      } finally {
        if (previous === undefined) {
          delete process.env.TAKT_PROVIDER_OPTIONS_DEEPSEEK_HARNESS_REASONING_EFFORT;
        } else {
          process.env.TAKT_PROVIDER_OPTIONS_DEEPSEEK_HARNESS_REASONING_EFFORT = previous;
        }
        invalidateGlobalConfigCache();
        invalidateAllResolvedConfigCache();
      }
    },
  );

  it.each(['assistant', 'non-workflow'] as const)(
    'applies an explicit DeepSeek option when a provider override selects DeepSeek for %s',
    (consumer) => {
      writeGlobalConfig(['language: en']);
      writeGlobalRuntimeFile({
        version: 1,
        provider: {
          defaults: { profile: 'default' },
          profiles: {
            default: {
              provider: 'codex',
              model: 'gpt-runtime',
              options: { fast_mode: true },
            },
          },
        },
      });
      const previousProvider = process.env.TAKT_PROVIDER;
      const previousEffort = process.env.TAKT_PROVIDER_OPTIONS_DEEPSEEK_HARNESS_REASONING_EFFORT;
      process.env.TAKT_PROVIDER = 'deepseek-harness';
      process.env.TAKT_PROVIDER_OPTIONS_DEEPSEEK_HARNESS_REASONING_EFFORT = 'low';
      invalidateGlobalConfigCache();
      invalidateAllResolvedConfigCache();
      try {
        const context = initializeSession(
          projectCwd,
          consumer === 'assistant' ? 'interactive' : 'coder',
        );

        expect(context.providerType).toBe('deepseek-harness');
        expect(context.providerOptions).toEqual({
          deepseekHarness: { reasoningEffort: 'low' },
        });
      } finally {
        if (previousProvider === undefined) {
          delete process.env.TAKT_PROVIDER;
        } else {
          process.env.TAKT_PROVIDER = previousProvider;
        }
        if (previousEffort === undefined) {
          delete process.env.TAKT_PROVIDER_OPTIONS_DEEPSEEK_HARNESS_REASONING_EFFORT;
        } else {
          process.env.TAKT_PROVIDER_OPTIONS_DEEPSEEK_HARNESS_REASONING_EFFORT = previousEffort;
        }
        invalidateGlobalConfigCache();
        invalidateAllResolvedConfigCache();
      }
    },
  );

  it('rejects a project provider option when an unrelated environment option is present', () => {
    writeGlobalConfig([
      'language: en',
      'provider_options:',
      '  codex:',
      '    network_access: true',
    ]);
    writeGlobalRuntimeFile(activeRuntimeSection());
    const previousEffort = process.env.TAKT_PROVIDER_OPTIONS_DEEPSEEK_HARNESS_REASONING_EFFORT;
    process.env.TAKT_PROVIDER_OPTIONS_DEEPSEEK_HARNESS_REASONING_EFFORT = 'low';
    invalidateGlobalConfigCache();
    invalidateAllResolvedConfigCache();
    try {
      expect(() => resolveAuxiliaryProviderEnvironment(projectCwd, WORKFLOW))
        .toThrow(/config\.yaml:provider_options/);
    } finally {
      if (previousEffort === undefined) {
        delete process.env.TAKT_PROVIDER_OPTIONS_DEEPSEEK_HARNESS_REASONING_EFFORT;
      } else {
        process.env.TAKT_PROVIDER_OPTIONS_DEEPSEEK_HARNESS_REASONING_EFFORT = previousEffort;
      }
      invalidateGlobalConfigCache();
      invalidateAllResolvedConfigCache();
    }
  });

  it('composes environment options for a companion that falls back to runtime defaults', () => {
    writeGlobalConfig(['language: en']);
    writeGlobalRuntimeFile({
      version: 1,
      companion: { enabled: true },
      provider: {
        defaults: { profile: 'default' },
        profiles: {
          default: {
            provider: 'deepseek-harness',
            model: 'deepseek-v4-flash',
            options: { max_tokens: 4096, reasoning_effort: 'high' },
          },
        },
      },
    });
    const previousEffort = process.env.TAKT_PROVIDER_OPTIONS_DEEPSEEK_HARNESS_REASONING_EFFORT;
    process.env.TAKT_PROVIDER_OPTIONS_DEEPSEEK_HARNESS_REASONING_EFFORT = 'low';
    invalidateGlobalConfigCache();
    invalidateAllResolvedConfigCache();
    try {
      const runtime = resolveAuxiliaryRuntimeEnvironment(projectCwd, COMPANION_WORKFLOW);
      const companions = resolveWorkflowCompanions(COMPANION_WORKFLOW, runtime.providerEnvironment, {
        projectCwd,
        lookupCwd: projectCwd,
        providerConfigMode: runtime.providerConfigMode,
        providerSectionActive: runtime.providerSectionActive,
        providerOptionsResolution: {
          configProviderOptions: runtime.configProviderOptions,
          providerOptionsSource: runtime.providerOptionsSource,
          providerOptionsOriginResolver: runtime.providerOptionsOriginResolver,
        },
      });

      expect(companions.get('security-reviewer')).toMatchObject({
        provider: 'deepseek-harness',
        model: 'deepseek-v4-flash',
        providerOptions: {
          deepseekHarness: { maxTokens: 4096, reasoningEffort: 'low' },
        },
      });
    } finally {
      if (previousEffort === undefined) {
        delete process.env.TAKT_PROVIDER_OPTIONS_DEEPSEEK_HARNESS_REASONING_EFFORT;
      } else {
        process.env.TAKT_PROVIDER_OPTIONS_DEEPSEEK_HARNESS_REASONING_EFFORT = previousEffort;
      }
      invalidateGlobalConfigCache();
      invalidateAllResolvedConfigCache();
    }
  });

  it('propagates the effective companion review mode through the auxiliary runtime environment', () => {
    writeGlobalConfig(['language: en']);
    writeGlobalRuntimeFile({
      ...activeRuntimeSection(),
      companion: { enabled: true, review_mode: 'live' },
    } as unknown as RuntimeProviderFile);
    invalidateGlobalConfigCache();
    invalidateAllResolvedConfigCache();

    const env = resolveAuxiliaryRuntimeEnvironment(projectCwd, WORKFLOW);

    expect((env as unknown as { companionReviewMode?: string }).companionReviewMode).toBe('live');
  });

  it('Given companion.fix_policy is loop, When resolving auxiliary runtime environment, Then it resolves to loop', () => {
    writeGlobalConfig(['language: en']);
    writeGlobalRuntimeFile({
      ...activeRuntimeSection(),
      companion: { enabled: true, fix_policy: 'loop' },
    } as unknown as RuntimeProviderFile);
    invalidateGlobalConfigCache();
    invalidateAllResolvedConfigCache();

    const env = resolveAuxiliaryRuntimeEnvironment(projectCwd, WORKFLOW);

    expect((env as unknown as { companionFixPolicy?: string }).companionFixPolicy).toBe('loop');
  });

  it('Given companion.fix_policy is omitted, When resolving auxiliary runtime environment, Then it defaults to single', () => {
    writeGlobalConfig(['language: en']);
    writeGlobalRuntimeFile({
      ...activeRuntimeSection(),
      companion: { enabled: true },
    } as unknown as RuntimeProviderFile);
    invalidateGlobalConfigCache();
    invalidateAllResolvedConfigCache();

    const env = resolveAuxiliaryRuntimeEnvironment(projectCwd, WORKFLOW);

    expect((env as unknown as { companionFixPolicy?: string }).companionFixPolicy).toBe('single');
  });

  it('passes legacy config.yaml provider/model through unchanged when no active runtime section exists', () => {
    writeGlobalConfig(['language: en', 'provider: opencode', 'model: opencode/big-pickle']);
    invalidateGlobalConfigCache();
    invalidateAllResolvedConfigCache();

    const env = resolveAuxiliaryProviderEnvironment(projectCwd, WORKFLOW);

    expect(env.provider).toBe('opencode');
    expect(env.model).toBe('opencode/big-pickle');
    expect(env.providerSource).toBe('global');
    expect(env.tagConflictPolicy).toBe('last-wins');
  });

  it('fails fast when an active runtime section coexists with a legacy config.yaml provider', () => {
    writeGlobalConfig(['language: en', 'provider: opencode', 'model: opencode/big-pickle']);
    writeGlobalRuntimeFile(activeRuntimeSection());
    invalidateGlobalConfigCache();
    invalidateAllResolvedConfigCache();

    expect(() => resolveAuxiliaryProviderEnvironment(projectCwd, WORKFLOW))
      .toThrow(MIXED_CONFIG_PROVIDER_ERROR);
  });
});

function writeWorkflow(fileName: string, lines: string[]): void {
  const workflowDir = join(getProjectConfigDir(projectCwd), 'workflows');
  mkdirSync(workflowDir, { recursive: true });
  writeFileSync(join(workflowDir, fileName), `${lines.join('\n')}\n`);
}

describe('getWorkflowDescription consumes the compiled provider environment', () => {
  beforeEach(() => {
    projectCwd = mkdtempSync(join(tmpdir(), 'takt-aux-preview-project-'));
    mkdirSync(getProjectConfigDir(projectCwd), { recursive: true });
    invalidateGlobalConfigCache();
    invalidateAllResolvedConfigCache();
  });

  afterEach(() => {
    rmSync(projectCwd, { recursive: true, force: true });
    invalidateGlobalConfigCache();
    invalidateAllResolvedConfigCache();
  });

  it('previews runtime.yaml profiles.default provider/model and resolves allowed-tools against it', () => {
    writeGlobalConfig(['language: en']);
    writeGlobalRuntimeFile({
      version: 1,
      provider: {
        defaults: { profile: 'default' },
        profiles: {
          default: {
            provider: 'opencode',
            model: 'opencode/big-pickle',
            options: { allowed_tools: ['read', 'grep'] },
            permission_mode: 'readonly',
          },
        },
      },
    });
    invalidateGlobalConfigCache();
    invalidateAllResolvedConfigCache();
    writeWorkflow('preview-runtime.yaml', [
      'name: preview-runtime',
      'initial_step: implement',
      'max_steps: 1',
      'steps:',
      '  - name: implement',
      '    instruction: Implement the change.',
      '    rules:',
      '      - condition: done',
      '        next: COMPLETE',
    ]);

    const description = getWorkflowDescription('preview-runtime', projectCwd, 1);
    const step = description.stepPreviews[0] as {
      name: string;
      provider?: string;
      model?: string;
      permissionMode?: string;
      allowedTools: string[];
    };

    // provider/model come from the runtime.yaml bundle, and allowed-tools resolve from that
    // profile's provider options (not a silent legacy default).
    expect(step).toMatchObject({
      name: 'implement',
      provider: 'opencode',
      model: 'opencode/big-pickle',
      permissionMode: 'readonly',
    });
    expect(step.allowedTools).toEqual(['read', 'grep']);
  });

  it('previews only the winning step profile options and permission', () => {
    writeGlobalConfig(['language: en']);
    writeGlobalRuntimeFile({
      version: 1,
      provider: {
        defaults: { profile: 'default' },
        profiles: {
          default: {
            provider: 'opencode',
            model: 'opencode/big-pickle',
            options: { allowed_tools: ['read', 'grep'] },
            permission_mode: 'readonly',
          },
          plain: { provider: 'claude', model: 'sonnet' },
        },
        targets: { steps: { implement: { profile: 'plain' } } },
      },
    });
    invalidateGlobalConfigCache();
    invalidateAllResolvedConfigCache();
    writeWorkflow('preview-step-profile.yaml', [
      'name: preview-step-profile',
      'initial_step: implement',
      'max_steps: 1',
      'steps:',
      '  - name: implement',
      '    instruction: Implement the change.',
      '    rules:',
      '      - condition: done',
      '        next: COMPLETE',
    ]);

    const step = getWorkflowDescription('preview-step-profile', projectCwd, 1).stepPreviews[0];

    expect(step).toMatchObject({ provider: 'claude', model: 'sonnet', allowedTools: [] });
    expect(step).not.toHaveProperty('permissionMode');
  });

  it('fails fast when a step maps to conflicting same-priority tag routing in runtime-v1', () => {
    writeGlobalConfig(['language: en']);
    writeGlobalRuntimeFile({
      version: 1,
      provider: {
        defaults: { profile: 'default' },
        profiles: {
          default: { provider: 'codex', model: 'gpt-runtime' },
          a: { provider: 'claude', model: 'sonnet' },
          b: { provider: 'opencode', model: 'qwen' },
        },
        targets: {
          tags: {
            t1: { profile: 'a' },
            t2: { profile: 'b' },
          },
        },
      },
    });
    invalidateGlobalConfigCache();
    invalidateAllResolvedConfigCache();
    writeWorkflow('preview-tag-conflict.yaml', [
      'name: preview-tag-conflict',
      'initial_step: implement',
      'max_steps: 1',
      'steps:',
      '  - name: implement',
      '    instruction: Implement the change.',
      '    tags: [t1, t2]',
      '    rules:',
      '      - condition: done',
      '        next: COMPLETE',
    ]);

    expect(() => getWorkflowDescription('preview-tag-conflict', projectCwd, 1))
      .toThrow(/[Cc]onflicting provider routing/);
  });

  it('resolves same-priority tag routing in legacy mode by last-wins', () => {
    writeGlobalConfig([
      'language: en',
      'provider: claude',
      'model: sonnet',
      'provider_routing:',
      '  tags:',
      '    t1:',
      '      provider: claude',
      '      model: sonnet',
      '    t2:',
      '      provider: codex',
      '      model: gpt-5',
    ]);
    invalidateGlobalConfigCache();
    invalidateAllResolvedConfigCache();
    writeWorkflow('preview-legacy-tags.yaml', [
      'name: preview-legacy-tags',
      'initial_step: implement',
      'max_steps: 1',
      'steps:',
      '  - name: implement',
      '    instruction: Implement the change.',
      '    tags: [t1, t2]',
      '    rules:',
      '      - condition: done',
      '        next: COMPLETE',
    ]);

    const description = getWorkflowDescription('preview-legacy-tags', projectCwd, 1);

    // Legacy last-wins: the last matching tag (t2) supplies the provider/model. A first-wins or
    // defaults regression would surface claude/sonnet here.
    expect(description.stepPreviews).toContainEqual(
      expect.objectContaining({
        name: 'implement',
        provider: 'codex',
        model: 'gpt-5',
      }),
    );
  });

  it('fails fast in preview when an active runtime section coexists with a legacy provider', () => {
    writeGlobalConfig(['language: en', 'provider: opencode', 'model: opencode/big-pickle']);
    writeGlobalRuntimeFile(activeRuntimeSection());
    invalidateGlobalConfigCache();
    invalidateAllResolvedConfigCache();
    writeWorkflow('preview-mixed.yaml', [
      'name: preview-mixed',
      'initial_step: implement',
      'max_steps: 1',
      'steps:',
      '  - name: implement',
      '    instruction: Implement the change.',
      '    rules:',
      '      - condition: done',
      '        next: COMPLETE',
    ]);

    expect(() => getWorkflowDescription('preview-mixed', projectCwd, 1))
      .toThrow(MIXED_CONFIG_PROVIDER_ERROR);
  });

  it('passes legacy config.yaml provider/model through preview when no runtime section exists', () => {
    writeGlobalConfig(['language: en', 'provider: opencode', 'model: opencode/big-pickle']);
    invalidateGlobalConfigCache();
    invalidateAllResolvedConfigCache();
    writeWorkflow('preview-legacy.yaml', [
      'name: preview-legacy',
      'initial_step: implement',
      'max_steps: 1',
      'steps:',
      '  - name: implement',
      '    instruction: Implement the change.',
      '    rules:',
      '      - condition: done',
      '        next: COMPLETE',
    ]);

    const description = getWorkflowDescription('preview-legacy', projectCwd, 1);

    expect(description.stepPreviews[0]).toMatchObject({
      name: 'implement',
      provider: 'opencode',
      model: 'opencode/big-pickle',
    });
  });

  it('prints effective runtime selector options with the environment winner', async () => {
    writeGlobalConfig(['language: en']);
    writeGlobalRuntimeFile({
      version: 1,
      provider: {
        defaults: { profile: 'default' },
        profiles: {
          default: {
            provider: 'deepseek-harness',
            model: 'default-model',
            options: { max_tokens: 4096, reasoning_effort: 'high' },
          },
          selector: {
            provider: 'deepseek-harness',
            model: 'selector-model',
            options: { max_tokens: 4096, reasoning_effort: 'high' },
          },
        },
        targets: { internal_agents: { selector: { profile: 'selector' } } },
      },
    });
    const previousEffort = process.env.TAKT_PROVIDER_OPTIONS_DEEPSEEK_HARNESS_REASONING_EFFORT;
    process.env.TAKT_PROVIDER_OPTIONS_DEEPSEEK_HARNESS_REASONING_EFFORT = 'low';
    invalidateGlobalConfigCache();
    invalidateAllResolvedConfigCache();
    writeWorkflow('preview-deepseek.yaml', [
      'name: preview-deepseek',
      'initial_step: reviewers',
      'max_steps: 1',
      'steps:',
      '  - name: reviewers',
      '    instruction: Review the change.',
      '    parallel:',
      '      fixed: []',
      '      pool:',
      '        - name: security',
      '          description: Review security.',
      '          instruction: Review security.',
      '          rules:',
      '            - condition: approved',
      '              next: COMPLETE',
      '      selection:',
      '        mode: replace',
      '    rules:',
      '      - condition: all("approved")',
      '        next: COMPLETE',
    ]);

    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    let output = '';
    try {
      await previewPrompts(projectCwd, 'preview-deepseek');
      output = log.mock.calls.flat().join('\n');
    } finally {
      log.mockRestore();
      if (previousEffort === undefined) {
        delete process.env.TAKT_PROVIDER_OPTIONS_DEEPSEEK_HARNESS_REASONING_EFFORT;
      } else {
        process.env.TAKT_PROVIDER_OPTIONS_DEEPSEEK_HARNESS_REASONING_EFFORT = previousEffort;
      }
      invalidateGlobalConfigCache();
      invalidateAllResolvedConfigCache();
    }

    expect(output).toContain('Dynamic selector provider options:');
    expect(output).toContain('"maxTokens":4096');
    expect(output).toContain('"reasoningEffort":"low"');
  });
});

describe('resolveConfiguredExecProviderModel consumes the compiled provider environment', () => {
  beforeEach(() => {
    projectCwd = mkdtempSync(join(tmpdir(), 'takt-aux-exec-project-'));
    mkdirSync(getProjectConfigDir(projectCwd), { recursive: true });
    invalidateGlobalConfigCache();
    invalidateAllResolvedConfigCache();
  });

  afterEach(() => {
    rmSync(projectCwd, { recursive: true, force: true });
    invalidateGlobalConfigCache();
    invalidateAllResolvedConfigCache();
  });

  it('returns the runtime.yaml profiles.default provider/model in a runtime-v1 environment', () => {
    writeGlobalConfig(['language: en']);
    writeGlobalRuntimeFile(activeRuntimeSection());
    invalidateGlobalConfigCache();
    invalidateAllResolvedConfigCache();

    expect(resolveConfiguredExecProviderModel(projectCwd)).toEqual({
      provider: 'codex',
      model: 'gpt-runtime',
    });
  });

  it('fails fast when an active runtime section coexists with a legacy config.yaml provider', () => {
    writeGlobalConfig(['language: en', 'provider: opencode', 'model: opencode/big-pickle']);
    writeGlobalRuntimeFile(activeRuntimeSection());
    invalidateGlobalConfigCache();
    invalidateAllResolvedConfigCache();

    expect(() => resolveConfiguredExecProviderModel(projectCwd))
      .toThrow(MIXED_CONFIG_PROVIDER_ERROR);
  });

  it('passes the legacy config.yaml provider/model through when no runtime section exists', () => {
    writeGlobalConfig(['language: en', 'provider: opencode', 'model: opencode/big-pickle']);
    invalidateGlobalConfigCache();
    invalidateAllResolvedConfigCache();

    expect(resolveConfiguredExecProviderModel(projectCwd)).toEqual({
      provider: 'opencode',
      model: 'opencode/big-pickle',
    });
  });
});
