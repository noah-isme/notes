import { describe, it, expect } from 'vitest';
import { noteToDocxBuffer } from '$lib/server/export/render-docx';

const DOCX_MAGIC = 'PK';

const FULL_NOTE = `# Export Test **bold**

Paragraph with *italic*, **bold**, ~~strike~~, \`inline\` and a [link](https://example.com).

- bullet one
- bullet two
  - nested bullet

1. first
2. second

> quoted text with **bold**

\`\`\`typescript
const x = 1;
const y = 2;
\`\`\`

| Name | Value |
|:-----|------:|
| a | 1 |
| b | 2 |

---

Final paragraph.
`;

const OPTIONS = {
  title: 'Export Test Note',
  author: 'demo@example.com',
  tags: [{ name: 'welcome' }, { name: 'work' }],
  updatedAt: new Date('2026-09-01T10:00:00Z'),
};

async function generate(markdown: string = FULL_NOTE) {
  return noteToDocxBuffer(markdown, OPTIONS);
}

describe('Unit: DOCX Export Renderer', () => {
  it('produces a non-empty zip (PK magic) buffer', async () => {
    const buffer = await generate();
    expect(buffer.length).toBeGreaterThan(1000);
    expect(buffer.subarray(0, 2).toString('latin1')).toBe(DOCX_MAGIC);
  });

  it('produces the same valid structure for every markdown feature in isolation', async () => {
    const cases = [
      '# Just a heading',
      'plain paragraph',
      '- a\n- b',
      '1. a\n2. b',
      '> quote',
      '```\ncode\n```',
      '| a | b |\n|--|--|\n| 1 | 2 |',
      '---',
      'text with [link](https://example.com) and `code` and **bold**',
      '',
    ];
    for (const md of cases) {
      const buffer = await generate(md);
      expect(buffer.subarray(0, 2).toString('latin1')).toBe(DOCX_MAGIC);
      expect(buffer.length).toBeGreaterThan(500);
    }
  });

  it('does not throw for empty notes', async () => {
    const buffer = await generate('');
    expect(buffer.subarray(0, 2).toString('latin1')).toBe(DOCX_MAGIC);
  });

  it('does not throw for adversarial markdown', async () => {
    const adversarial = [
      '#'.repeat(20) + ' deep heading',
      '-'.repeat(50),
      '|'.repeat(30),
      '*'.repeat(40),
      '> ' + '>'.repeat(30),
      '\n\n\n\n\n',
      '~~~\nunclosed fence',
      '1. one\n1. one\n1. one',
      '- outer\n    - very\n      - deeply\n        - nested',
    ].join('\n\n');

    const buffer = await generate(adversarial);
    expect(buffer.subarray(0, 2).toString('latin1')).toBe(DOCX_MAGIC);
  });
});
