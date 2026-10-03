import { describe, expect, it, vi } from 'vitest';
import type { AgentResponse } from '../core/models/types.js';
import type { ProviderAgent } from '../infra/providers/types.js';
import { AGENT_FAILURE_CATEGORIES } from '../shared/types/agent-failure.js';
import { DeepSeekHarnessProvider } from '../infra/providers/deepseek-harness.js';
import { callAIWithRetry } from '../features/interactive/aiCaller.js';
import { createAssistantConversationPlan } from '../features/interactive/conversationPlan.js';
import { makeProvider, makeSessionContext } from './test-helpers.js';

const deepSeekClientCall = vi.hoisted(() => vi.fn());

vi.mock('../infra/deepseek-harness/index.js', () => ({
  callDeepSeekHarness: deepSeekClientCall,
}));

const SESSION_CONTINUATION_DIAGNOSTIC = 'DeepSeek Harness cannot continue this session after runtime replacement or teardown; start a new TAKT session or run.';

describe('interactive session continuation refusal', () => {
  it('does not retry without the persisted session after a DeepSeek continuation refusal', async () => {
    const refusal: AgentResponse = {
      persona: 'interactive',
      status: 'error',
      content: SESSION_CONTINUATION_DIAGNOSTIC,
      error: SESSION_CONTINUATION_DIAGNOSTIC,
      timestamp: new Date('2026-10-02T00:00:00.000Z'),
    };
    refusal.failureCategory = AGENT_FAILURE_CATEGORIES.SESSION_CONTINUATION_UNSUPPORTED;
    const providerCall = vi.fn<ProviderAgent['call']>().mockResolvedValue(refusal);
    const provider = makeProvider({ setup: () => ({ call: providerCall }) });

    const result = await callAIWithRetry(
      'continue the saved conversation',
      'system prompt',
      [],
      '/workspace',
      makeSessionContext({
        provider,
        providerType: 'deepseek-harness',
        sessionId: 'persisted-session',
      }),
      { outputMode: 'silent' },
    );

    expect(providerCall).toHaveBeenCalledOnce();
    expect(providerCall.mock.calls[0]?.[1].sessionId).toBe('persisted-session');
    expect(result).toMatchObject({
      sessionId: 'persisted-session',
      result: {
        success: false,
        content: SESSION_CONTINUATION_DIAGNOSTIC,
      },
    });
  });

  it.each([{ tools: ['Read'] }, { tools: [] }])('passes an explicit interactive allowedTools list $tools to the DeepSeek guard before client startup', async ({ tools }) => {
    vi.clearAllMocks();
    const context = makeSessionContext({
      provider: new DeepSeekHarnessProvider(),
      providerType: 'deepseek-harness',
    });

    const result = await callAIWithRetry(
      'use the interactive tool constraint',
      'system prompt',
      tools,
      '/workspace',
      context,
      { outputMode: 'silent' },
    );

    expect(deepSeekClientCall).not.toHaveBeenCalled();
    expect(result.result).toMatchObject({
      success: false,
      content: expect.stringContaining('cannot honor allowedTools'),
    });
  });

  it('uses native tools through the default assistant plan and public interactive caller', async () => {
    vi.clearAllMocks();
    deepSeekClientCall.mockResolvedValue({
      persona: 'interactive',
      status: 'done',
      content: 'mock DeepSeek response',
      timestamp: new Date('2026-10-02T00:00:00.000Z'),
    });
    const context = makeSessionContext({
      provider: new DeepSeekHarnessProvider(),
      providerType: 'deepseek-harness',
    });
    const plan = createAssistantConversationPlan('/workspace', {
      assistantMode: 'assistant', formalSpec: false, formalSpecComments: false,
      modelCheckTimeoutSeconds: 30, resolvedSessionContext: context,
    });

    const result = await callAIWithRetry(
      'continue without an allowlist',
      plan.strategy.systemPrompt,
      plan.strategy.allowedTools,
      '/workspace',
      plan.ctx,
      { outputMode: 'silent' },
    );

    expect(deepSeekClientCall).toHaveBeenCalledOnce();
    expect(result.result).toMatchObject({ success: true, content: 'mock DeepSeek response' });
  });

  it('does not drop an explicit per-call DeepSeek permission constraint', async () => {
    vi.clearAllMocks();
    const result = await callAIWithRetry('read only', 'system', undefined, '/workspace', makeSessionContext({
      provider: new DeepSeekHarnessProvider(), providerType: 'deepseek-harness',
    }), { outputMode: 'silent', permissionMode: 'readonly' });
    expect(deepSeekClientCall).not.toHaveBeenCalled();
    expect(result.result?.success).toBe(false);
    expect(result.result?.content).toContain('permission');
  });
});
