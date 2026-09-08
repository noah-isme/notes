import { parseMarkdown } from './markdown';

export interface SlideData {
  index: number;
  rawMarkdown: string;
  renderedHtml: string;
  title: string;
}

/**
 * Splits markdown content into an array of slide objects.
 * Uses `---`, `***`, or `___` as the primary slide delimiter.
 * Falls back to `# ` and `## ` headings if no delimiters exist.
 */
export function extractSlides(markdown: string): SlideData[] {
  if (!markdown || !markdown.trim()) {
    const defaultText = '# Untitled Slide\n\n*No content provided.*';
    return [
      {
        index: 0,
        rawMarkdown: defaultText,
        renderedHtml: parseMarkdown(defaultText),
        title: 'Untitled Slide',
      },
    ];
  }

  const normalized = markdown.replace(/\r\n/g, '\n');

  // Check for explicit slide breaks
  const parts = normalized
    .split(/\n\s*(?:---|\*\*\*|___)\s*\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  let rawChunks: string[] = [];

  if (parts.length > 1) {
    rawChunks = parts;
  } else {
    // Fallback: split on `# ` or `## ` headings if multiple exist
    const headingParts = normalized
      .split(/(?=\n#{1,2}\s+)/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (headingParts.length > 1) {
      rawChunks = headingParts;
    } else {
      rawChunks = [normalized.trim()];
    }
  }

  return rawChunks.map((chunk, index) => {
    // Extract first heading if present
    const headingMatch = chunk.match(/^#{1,3}\s+(.+)$/m);
    const title = headingMatch
      ? headingMatch[1].replace(/[*_`]/g, '').trim()
      : `Slide ${index + 1}`;

    return {
      index,
      rawMarkdown: chunk,
      renderedHtml: parseMarkdown(chunk),
      title,
    };
  });
}
