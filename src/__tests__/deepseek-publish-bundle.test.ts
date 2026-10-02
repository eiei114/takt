import { describe, expect, it } from 'vitest';
import { prepareToolkitManifest } from '../../scripts/prepare-deepseek-publish-bundle.mjs';

const original = {
  name: '@deepseek-ai/libreoffice-kit', version: '0.1.5', license: 'MPL-2.0',
  dependencies: { fflate: '0.8.2', koffi: '3.1.1' },
};

describe('DeepSeek publish dependency bundle', () => {
  it('changes only the fflate declaration and leaves the original object untouched', () => {
    const patched = prepareToolkitManifest(original, '0.8.3');
    expect(patched).toEqual({ ...original, dependencies: { ...original.dependencies, fflate: '0.8.3' } });
    expect(original.dependencies.fflate).toBe('0.8.2');
  });
  it('is idempotent', () => {
    const patched = prepareToolkitManifest(original, '0.8.3');
    expect(prepareToolkitManifest(patched, '0.8.3')).toEqual(patched);
  });
  it('refuses an unpatched installed dependency', () => {
    expect(() => prepareToolkitManifest(original, '0.8.2')).toThrow('patched fflate');
  });
  it('refuses an unreviewed upstream toolkit or dependency declaration', () => {
    expect(() => prepareToolkitManifest({ ...original, version: '0.1.6' }, '0.8.3')).toThrow('toolkit changed');
    expect(() => prepareToolkitManifest({ ...original, dependencies: { fflate: '0.9.0' } }, '0.8.3')).toThrow('declaration changed');
  });
});
