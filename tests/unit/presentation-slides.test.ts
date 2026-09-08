import { describe, it, expect } from 'vitest';
import { extractSlides } from '../../src/lib/utils/slides';

describe('Presentation Slides Utility (extractSlides)', () => {
  it('should return a fallback slide when given empty or whitespace markdown', () => {
    const emptyResult = extractSlides('');
    expect(emptyResult).toHaveLength(1);
    expect(emptyResult[0].title).toBe('Untitled Slide');

    const whitespaceResult = extractSlides('   \n\n  ');
    expect(whitespaceResult).toHaveLength(1);
    expect(whitespaceResult[0].title).toBe('Untitled Slide');
  });

  it('should split markdown on explicit horizontal rules (---)', () => {
    const markdown = `# Slide 1: Introduction\n\nWelcome to the presentation.\n\n---\n\n# Slide 2: Architecture\n\nSystem design details.\n\n---\n\n# Slide 3: Conclusion\n\nThank you!`;
    const slides = extractSlides(markdown);

    expect(slides).toHaveLength(3);
    expect(slides[0].title).toBe('Slide 1: Introduction');
    expect(slides[1].title).toBe('Slide 2: Architecture');
    expect(slides[2].title).toBe('Slide 3: Conclusion');
    expect(slides[0].renderedHtml).toContain('Slide 1: Introduction');
    expect(slides[1].renderedHtml).toContain('System design details');
  });

  it('should split markdown on alternate horizontal rules (*** and ___)', () => {
    const markdown = `# First Topic\n\nContent A\n\n***\n\n# Second Topic\n\nContent B\n\n___\n\n# Third Topic\n\nContent C`;
    const slides = extractSlides(markdown);

    expect(slides).toHaveLength(3);
    expect(slides[0].title).toBe('First Topic');
    expect(slides[1].title).toBe('Second Topic');
    expect(slides[2].title).toBe('Third Topic');
  });

  it('should fallback to splitting on major headings when no horizontal rules exist', () => {
    const markdown = `# Welcome\n\nIntroductory text.\n\n# Chapter 1: Core Operations\n\nOperational guidelines.\n\n## Sub-topic 1.1\n\nDetails on sub-topic.`;
    const slides = extractSlides(markdown);

    expect(slides.length).toBeGreaterThanOrEqual(2);
    expect(slides[0].title).toBe('Welcome');
    expect(slides[1].title).toBe('Chapter 1: Core Operations');
  });

  it('should preserve and render embedded Mermaid diagrams in slide HTML', () => {
    const markdown = `# Architecture Overview\n\n\`\`\`mermaid\ngraph TD\n  A --> B\n\`\`\``;
    const slides = extractSlides(markdown);

    expect(slides).toHaveLength(1);
    expect(slides[0].renderedHtml).toContain('class="mermaid-block"');
    expect(slides[0].renderedHtml).toContain('graph TD');
    expect(slides[0].renderedHtml).toContain('A --&gt; B');
  });

  it('should preserve and render presentation image slides', () => {
    const markdown = `# Title Slide\n\n![Presentation Slide](/slides/it-functional-mapping-slide.jpg)\n\n---\n\n# Slide 2`;
    const slides = extractSlides(markdown);

    expect(slides).toHaveLength(2);
    expect(slides[0].renderedHtml).toContain('<img');
    expect(slides[0].renderedHtml).toContain('src="/slides/it-functional-mapping-slide.jpg"');
  });

  it('should assign valid sequential slide indices', () => {
    const markdown = `Slide A\n\n---\n\nSlide B\n\n---\n\nSlide C`;
    const slides = extractSlides(markdown);

    expect(slides).toHaveLength(3);
    expect(slides[0].index).toBe(0);
    expect(slides[1].index).toBe(1);
    expect(slides[2].index).toBe(2);
  });
});
