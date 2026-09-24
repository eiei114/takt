import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  resolveDeepSeekCredentialBinding,
  type DeepSeekCredentialBinding,
} from '../infra/deepseek-harness/credential-binding.js';
import type { DeepSeekHarnessProviderOptions } from '../core/models/workflow-types.js';

const DEFAULT_REF = 'DEEPSEEK_API_KEY';
const USER_HOME = path.join(tmpdir(), 'takt-deepseek-binding-user-home');
const SOURCE_HOME_A = path.join(tmpdir(), 'takt-deepseek-binding-home-a');
const SOURCE_HOME_B = path.join(tmpdir(), 'takt-deepseek-binding-home-b');

interface BindingOverrides {
  childProcessEnv?: Readonly<Record<string, string>>;
  ambientEnv?: Readonly<Record<string, string | undefined>>;
  userHome?: string;
  providerOptions?: DeepSeekHarnessProviderOptions;
  readSettings?: (settingsPath: string) => Promise<{ ref: string; storedBaseUrl?: string }>;
}

async function resolveBinding(overrides: BindingOverrides = {}): Promise<{
  binding: DeepSeekCredentialBinding;
  readSettings: ReturnType<typeof vi.fn> | undefined;
}> {
  const readSettings = overrides.readSettings === undefined
    ? undefined
    : vi.fn(overrides.readSettings);
  const binding = await resolveDeepSeekCredentialBinding({
    childProcessEnv: overrides.childProcessEnv,
    ambientEnv: overrides.ambientEnv ?? {},
    userHome: overrides.userHome ?? USER_HOME,
    providerOptions: overrides.providerOptions,
    ...(readSettings === undefined ? {} : { readSettings }),
  });
  return { binding, readSettings };
}

describe('DeepSeek Harness credential binding resolution', () => {
  it('binds the source home, default reference, and effective endpoint', async () => {
    const { binding } = await resolveBinding({
      childProcessEnv: { DSH_HOME: SOURCE_HOME_A },
    });

    expect(binding.home.origin).toBe('child-process-env');
    expect(binding.home.homePath).toBe(SOURCE_HOME_A);
    expect(binding.home.credentialsPath).toBe(path.join(SOURCE_HOME_A, '.credentials.yaml'));
    expect(binding.ref).toBe(DEFAULT_REF);
    expect(binding.endpoint).toBe('https://api.deepseek.com');
    expect(binding.fingerprint.length).toBeGreaterThan(0);
  });

  it('reads the selector from the settings path derived from the source home', async () => {
    const { binding, readSettings } = await resolveBinding({
      childProcessEnv: { DSH_HOME: SOURCE_HOME_A },
      readSettings: async () => ({ ref: 'CUSTOM_KEY' }),
    });

    expect(readSettings).toHaveBeenCalledWith(path.join(SOURCE_HOME_A, 'settings.yaml'));
    expect(binding.ref).toBe('CUSTOM_KEY');
  });

  it('uses the provider option endpoint and rejects a stored endpoint mismatch', async () => {
    const matched = await resolveBinding({
      childProcessEnv: { DSH_HOME: SOURCE_HOME_A },
      providerOptions: { baseUrl: 'https://api.deepseek.com/v1' },
      readSettings: async () => ({ ref: 'CUSTOM_KEY', storedBaseUrl: 'https://api.deepseek.com/v1' }),
    });
    expect(matched.binding.endpoint).toBe('https://api.deepseek.com/v1');

    await expect(resolveDeepSeekCredentialBinding({
      childProcessEnv: { DSH_HOME: SOURCE_HOME_A },
      ambientEnv: {},
      userHome: USER_HOME,
      providerOptions: { baseUrl: 'https://api.deepseek.com/v1' },
      readSettings: async () => ({ ref: 'CUSTOM_KEY', storedBaseUrl: 'https://other.example/v1' }),
    })).rejects.toThrow(/endpoint|baseURL/iu);
  });

  it('propagates a settings reader failure instead of continuing with a default reference', async () => {
    await expect(resolveDeepSeekCredentialBinding({
      childProcessEnv: { DSH_HOME: SOURCE_HOME_A },
      ambientEnv: {},
      userHome: USER_HOME,
      readSettings: async () => {
        throw new Error('DeepSeek Harness credentials settings are invalid');
      },
    })).rejects.toThrow('DeepSeek Harness credentials settings are invalid');
  });

  it('keeps one fingerprint for identical non-secret inputs', async () => {
    const first = await resolveBinding({ childProcessEnv: { DSH_HOME: SOURCE_HOME_A } });
    const second = await resolveBinding({ childProcessEnv: { DSH_HOME: SOURCE_HOME_A } });

    expect(first.binding.fingerprint).toBe(second.binding.fingerprint);
  });

  it('changes the fingerprint when the source home changes', async () => {
    const first = await resolveBinding({ childProcessEnv: { DSH_HOME: SOURCE_HOME_A } });
    const second = await resolveBinding({ childProcessEnv: { DSH_HOME: SOURCE_HOME_B } });

    expect(first.binding.fingerprint).not.toBe(second.binding.fingerprint);
  });

  it('changes the fingerprint when the selected reference changes', async () => {
    const first = await resolveBinding({ readSettings: async () => ({ ref: 'FIRST_KEY' }) });
    const second = await resolveBinding({ readSettings: async () => ({ ref: 'SECOND_KEY' }) });

    expect(first.binding.fingerprint).not.toBe(second.binding.fingerprint);
  });

  it('changes the fingerprint when the effective endpoint changes', async () => {
    const first = await resolveBinding({
      providerOptions: { baseUrl: 'https://first.example/v1' },
    });
    const second = await resolveBinding({
      providerOptions: { baseUrl: 'https://second.example/v1' },
    });

    expect(first.binding.fingerprint).not.toBe(second.binding.fingerprint);
  });

  it('does not include the selected reference environment value in the fingerprint', async () => {
    const first = await resolveBinding({
      childProcessEnv: { CUSTOM_KEY: 'first-secret-value' },
      readSettings: async () => ({ ref: 'CUSTOM_KEY' }),
    });
    const second = await resolveBinding({
      childProcessEnv: { CUSTOM_KEY: 'second-secret-value' },
      readSettings: async () => ({ ref: 'CUSTOM_KEY' }),
    });

    expect(first.binding.fingerprint).toBe(second.binding.fingerprint);
    expect(first.binding.fingerprint).not.toContain('first-secret-value');
    expect(first.binding.fingerprint).not.toContain('second-secret-value');
  });
});
