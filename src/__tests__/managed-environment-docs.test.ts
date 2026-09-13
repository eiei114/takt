import { spawnSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
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

function primarySourcesOf(entry: string): string[] {
  const prefix = '- **Primary sources**: ';
  const line = entry.split('\n').find((candidate) => candidate.startsWith(prefix));
  if (line === undefined) {
    throw new Error('Primary sources are missing from the decision entry');
  }
  return line
    .slice(prefix.length)
    .split(';')
    .map((source) => source.trim().replace(/^`|`$/gu, ''));
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

  it('records one managed environment decision with the required primary sources', () => {
    const decisionLog = readFileSync(join(repositoryRoot, 'docs', 'decision-log.md'), 'utf8');
    const entries = decisionLog
      .split(/^##\s+/mu)
      .filter((entry) => /^Managed DeepSeek Harness environment\b/iu.test(entry));

    expect(entries).toHaveLength(1);
    const entry = entries[0];
    if (entry === undefined) {
      throw new Error('Managed DeepSeek Harness decision entry is missing');
    }

    const primarySources = primarySourcesOf(entry);
    expect(primarySources).toEqual(expect.arrayContaining([
      'https://github.com/nrslib/takt/issues/1560',
      'src/infra/deepseek-harness/pyproject.toml',
      'src/infra/deepseek-harness/uv.lock',
      'https://docs.astral.sh/uv/concepts/projects/sync/',
      'https://docs.astral.sh/uv/concepts/python-versions/',
      'https://docs.astral.sh/uv/concepts/cache/#cache-safety.',
    ]));
    for (const source of primarySources) {
      if (source.startsWith('https://')) {
        expect(source).toMatch(/^https:\/\/\S+$/u);
        expect(() => new URL(source)).not.toThrow();
        continue;
      }

      expect(source).not.toMatch(/^context(?:\/|$)/u);
      const sourceStats = statSync(join(repositoryRoot, source), { throwIfNoEntry: false });
      expect(sourceStats?.isFile(), source).toBe(true);

      const gitResult = spawnSync(
        'git',
        ['ls-files', '--cached', '--error-unmatch', '--', source],
        { cwd: repositoryRoot, encoding: 'utf8' },
      );
      if (gitResult.error !== undefined) {
        throw gitResult.error;
      }
      expect(gitResult.status, `${gitResult.stdout}\n${gitResult.stderr}`).toBe(0);
      expect(gitResult.stdout.trim(), source).toBe(source);
    }
  });
});
