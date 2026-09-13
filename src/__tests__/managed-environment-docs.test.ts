import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repositoryRoot = fileURLToPath(new URL('../..', import.meta.url));
const guideFiles = [
  { path: 'README.md', language: 'en' },
  { path: 'docs/README.ja.md', language: 'ja' },
  { path: 'docs/README.zh-CN.md', language: 'zh-CN' },
  { path: 'docs/configuration.md', language: 'en' },
  { path: 'docs/configuration.ja.md', language: 'ja' },
  { path: 'docs/configuration.zh-CN.md', language: 'zh-CN' },
  { path: 'docs/cli-reference.md', language: 'en' },
  { path: 'docs/cli-reference.ja.md', language: 'ja' },
  { path: 'docs/cli-reference.zh-CN.md', language: 'zh-CN' },
] as const;

function readGuide(path: string): string {
  return readFileSync(join(repositoryRoot, path), 'utf8');
}

function fencedCodeBlocks(document: string): string[] {
  const blocks: string[] = [];
  for (const match of document.matchAll(/```[^\n]*\n([\s\S]*?)```/gu)) {
    const block = match[1];
    if (block !== undefined) {
      blocks.push(block);
    }
  }
  return blocks;
}

describe('managed environment documentation', () => {
  it('does not advertise removed interpreter overrides in executable examples', () => {
    for (const guide of guideFiles) {
      const document = readGuide(guide.path);

      for (const codeBlock of fencedCodeBlocks(document)) {
        expect(codeBlock, `${guide.path} executable example`).not.toMatch(/--python|python_path/iu);
      }
    }
  });
});
