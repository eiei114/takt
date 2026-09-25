import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  AgentSession,
  createAgentSession,
  DefaultResourceLoader,
  ModelRuntime,
  SessionManager,
  SettingsManager,
  type ToolInfo,
} from '@earendil-works/pi-coding-agent';
import { InMemoryCredentialStore, InMemoryModelsStore } from '@earendil-works/pi-ai';
import { resolvePiActiveTools } from '../infra/providers/pi-tool-policy.js';

const READ_OVERRIDE_SENTINEL = 'takt-builtin-override-sentinel';
const READ_OVERRIDE_DESCRIPTION = 'TAKT fixture read override';

function readOverrideExtensionSource(projectCwd: string): string {
  return `
import { createReadToolDefinition } from '@earendil-works/pi-coding-agent';

export default function registerOverrideReadTool(pi) {
  pi.on('session_start', () => {
    pi.registerTool({
      ...createReadToolDefinition(${JSON.stringify(projectCwd)}),
      label: 'TAKT fixture read override',
      description: ${JSON.stringify(READ_OVERRIDE_DESCRIPTION)},
    });
  });
}
`;
}

interface OverrideSession {
  readonly root: string;
  readonly cwd: string;
  readonly extensionPath: string;
  readonly session: AgentSession;
}

async function createOverrideReadSession(): Promise<OverrideSession> {
  const root = mkdtempSync(path.join(tmpdir(), 'takt-pi-builtin-override-'));
  let session: AgentSession | undefined;
  try {
    const cwd = path.join(root, 'project');
    const agentDir = path.join(root, 'agent');
    const extensionPath = path.join(root, 'override-read-extension.js');
    const ignoredOrderPath = path.join(cwd, '.takt/runs/x/context/task/order.md');
    mkdirSync(path.dirname(ignoredOrderPath), { recursive: true });
    writeFileSync(path.join(cwd, '.gitignore'), '.takt/\n', 'utf8');
    writeFileSync(ignoredOrderPath, `# order\n${READ_OVERRIDE_SENTINEL}\n`, 'utf8');
    writeFileSync(extensionPath, readOverrideExtensionSource(cwd), 'utf8');

    const settingsManager = SettingsManager.inMemory({}, { projectTrusted: false });
    const resourceLoader = new DefaultResourceLoader({
      cwd,
      agentDir,
      settingsManager,
      additionalExtensionPaths: [extensionPath],
      noExtensions: true,
      noSkills: true,
      noPromptTemplates: true,
      noThemes: true,
      noContextFiles: true,
    });
    await resourceLoader.reload();
    const modelRuntime = await ModelRuntime.create({
      credentials: new InMemoryCredentialStore(),
      modelsPath: null,
      modelsStore: new InMemoryModelsStore(),
      allowModelNetwork: false,
      refreshOnCreate: false,
    });
    const result = await createAgentSession({
      cwd,
      agentDir,
      modelRuntime,
      resourceLoader,
      sessionManager: SessionManager.inMemory(cwd),
      settingsManager,
    });
    session = result.session;
    const bindErrors: unknown[] = [];
    await session.bindExtensions({
      mode: 'print',
      onError: (error) => bindErrors.push(error),
    });
    expect(result.extensionsResult.errors).toEqual([]);
    expect(bindErrors).toEqual([]);
    return { root, cwd, extensionPath, session };
  } catch (error) {
    session?.dispose();
    rmSync(root, { recursive: true, force: true });
    throw error;
  }
}

function disposeOverrideSession(setup: OverrideSession): void {
  setup.session.dispose();
  rmSync(setup.root, { recursive: true, force: true });
}

function toolInfos(setup: OverrideSession, allTools: ToolInfo[]) {
  return allTools.map((tool) => ({
    name: tool.name,
    source: tool.sourceInfo.source,
    sourcePath: path.resolve(setup.cwd, tool.sourceInfo.path),
  }));
}

describe('Pi builtin override integration', () => {
  it('activates an explicitly trusted extension read as the single read implementation', async () => {
    const setup = await createOverrideReadSession();
    try {
      const allTools = setup.session.getAllTools();
      const readEntries = allTools.filter((tool) => tool.name === 'read');
      expect(readEntries).toHaveLength(1);
      expect(readEntries[0]!.description).toBe(READ_OVERRIDE_DESCRIPTION);
      expect(path.resolve(setup.cwd, readEntries[0]!.sourceInfo.path)).toBe(setup.extensionPath);

      const activeTools = resolvePiActiveTools(
        'readonly',
        undefined,
        toolInfos(setup, allTools),
        [path.resolve(setup.cwd, setup.extensionPath)],
      );
      expect(activeTools).toEqual(['read', 'grep', 'find', 'ls']);

      setup.session.setActiveToolsByName(activeTools);
      expect(setup.session.getActiveToolNames()).toEqual(['read', 'grep', 'find', 'ls']);

      const readTool = setup.session.state.tools.find((tool) => tool.name === 'read');
      expect(readTool).toBeDefined();
      const result = await readTool!.execute(
        'takt-override-read',
        { path: '.takt/runs/x/context/task/order.md' },
        undefined,
        undefined,
      );
      const contentText = result.content
        .map((content) => (content.type === 'text' ? content.text : ''))
        .join('\n');
      expect(contentText).toContain(READ_OVERRIDE_SENTINEL);
    } finally {
      disposeOverrideSession(setup);
    }
  });

  it('keeps the same extension read inactive when it is not explicitly trusted', async () => {
    const setup = await createOverrideReadSession();
    try {
      const allTools = setup.session.getAllTools();
      expect(allTools.filter((tool) => tool.name === 'read')).toHaveLength(1);

      const activeTools = resolvePiActiveTools('readonly', undefined, toolInfos(setup, allTools), []);
      expect(activeTools).toEqual(['grep', 'find', 'ls']);

      setup.session.setActiveToolsByName(activeTools);
      expect(setup.session.getActiveToolNames()).toEqual(['grep', 'find', 'ls']);
    } finally {
      disposeOverrideSession(setup);
    }
  });
});
