import { describe, expect, it } from 'vitest';
import { redactProviderOptions } from '../core/workflow/providerOptionsRedaction.js';

describe('provider option redaction', () => {
  it('redacts credentials embedded in Pi extension URLs', () => {
    const options = {
      pi: {
        extensions: [
          'https://user:secret@example.com/pi-extension.git',
          'https://example.com/pi-extension.git?token=secret&ref=main',
          'git+ssh://git@example.com/pi-extension.git',
          'npm:pi-fff',
        ],
      },
    };

    expect(redactProviderOptions(options)).toEqual({
      pi: {
        extensions: [
          'https://[configured]@example.com/pi-extension.git',
          'https://example.com/pi-extension.git?token=[configured]&ref=main',
          'git+ssh://[configured]@example.com/pi-extension.git',
          'npm:pi-fff',
        ],
      },
    });
    expect(options.pi.extensions[0]).toContain('secret');
  });
});
