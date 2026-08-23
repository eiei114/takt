import { describe, expect, it } from 'vitest';
import { parseDeepSeekHarnessModelReference } from '../infra/deepseek-harness/model-reference.js';

function expectActionableParseError(reference: string, location: RegExp): void {
  let message: string | undefined;
  try {
    parseDeepSeekHarnessModelReference(reference);
  } catch (error) {
    message = error instanceof Error ? error.message : String(error);
  }

  expect(message).toBeDefined();
  if (message === undefined) {
    throw new Error('DeepSeek Harness model reference was accepted unexpectedly');
  }
  if (reference.length > 0) {
    expect(message).toContain(reference);
  } else {
    expect(message).toMatch(/empty|""/iu);
  }
  expect(message).toMatch(location);
}

describe('DeepSeek Harness model references', () => {
  it.each([
    ['openai/gpt-5.4', { provider: 'openai', model: 'gpt-5.4' }],
    ['openai-codex/gpt-5.6-luna', { provider: 'openai-codex', model: 'gpt-5.6-luna' }],
    ['anthropic/claude-sonnet-4-6', { provider: 'anthropic', model: 'claude-sonnet-4-6' }],
    ['my-gateway/org/custom-model', { provider: 'my-gateway', model: 'org/custom-model' }],
    ['deepseek-v4-flash', { provider: 'deepseek-official', model: 'deepseek-v4-flash' }],
  ] as const)('separates the route from the model for %s', (reference, expected) => {
    expect(parseDeepSeekHarnessModelReference(reference)).toEqual(expected);
  });

  it.each([
    'openai/gpt-5.4:max',
    'openai-codex/gpt-5.6-luna:max',
    'my-gateway/org/custom-model:high',
    'deepseek-v4-flash:max',
    'deepseek-v4-flash:',
  ] as const)('rejects an effort suffix without forwarding it as part of the model: %s', (reference) => {
    expectActionableParseError(reference, /effort|suffix/iu);
  });

  it.each([
    '/gpt-5.4',
    'openai/',
    '/',
    '',
  ] as const)('rejects an empty or malformed model reference: %s', (reference) => {
    expectActionableParseError(reference, /model reference|route|model|empty/iu);
  });
});
