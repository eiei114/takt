import { sanitizeTextWithValues } from '../../shared/utils/sensitive-text.js';

export function sanitizeDeepSeekHarnessKnownSecrets(
  text: string,
  knownSecrets: Readonly<Record<string, string>>,
): string {
  const values = new Set<string>();
  for (const [name, value] of Object.entries(knownSecrets)) {
    if (
      (name === 'DEEPSEEK_API_KEY'
        || name === 'DEEPSEEK_BASE_URL'
        || name.startsWith('DEEPSEEK_URL_CREDENTIAL_'))
      && value.length > 0
    ) {
      values.add(value);
    }
  }
  return sanitizeTextWithValues(text, values);
}
