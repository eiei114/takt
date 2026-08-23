import { DEEPSEEK_HARNESS_DEFAULT_PROVIDER } from './constants.js';

export interface DeepSeekHarnessModelReference {
  provider: string;
  model: string;
}

function invalidModelReference(reference: string, reason: string): Error {
  return new Error(`Invalid DeepSeek Harness model reference ${JSON.stringify(reference)}: ${reason}`);
}

export function parseDeepSeekHarnessModelReference(
  reference: string,
): DeepSeekHarnessModelReference {
  const normalizedReference = reference.trim();
  if (normalizedReference.length === 0) {
    throw invalidModelReference(reference, 'model reference must not be empty');
  }

  const separatorIndex = normalizedReference.indexOf('/');
  const rawProvider = separatorIndex === -1
    ? DEEPSEEK_HARNESS_DEFAULT_PROVIDER
    : normalizedReference.slice(0, separatorIndex);
  const rawModel = separatorIndex === -1
    ? normalizedReference
    : normalizedReference.slice(separatorIndex + 1);
  const provider = rawProvider.trim();
  const model = rawModel.trim();

  if (provider.length === 0) {
    throw invalidModelReference(reference, 'provider route must not be empty');
  }
  if (model.length === 0) {
    throw invalidModelReference(reference, 'model must not be empty');
  }
  if (model.includes(':')) {
    throw invalidModelReference(
      reference,
      'effort suffixes are not supported because the DeepSeek Harness SDK has no separate effort field',
    );
  }

  return { provider, model };
}
