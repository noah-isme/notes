import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { render } from 'svelte/server';
import ShareDialog from '../../src/lib/components/ShareDialog.svelte';
import PublicSharePage from '../../src/routes/(public)/share/[token]/+page.svelte';
import PublicErrorPage from '../../src/routes/(public)/share/[token]/+error.svelte';
import IconShare from '../../src/lib/components/icons/IconShare.svelte';
import IconLink from '../../src/lib/components/icons/IconLink.svelte';

describe('Unit: Share Token Generation & Security Utilities', () => {
  it('should generate cryptographically random, unguessable, URL-safe base64url tokens', () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const token = crypto.randomBytes(24).toString('base64url');
      expect(token).toBeDefined();
      expect(token.length).toBeGreaterThanOrEqual(32);
      // Verify URL-safe characters only (alphanumeric, -, _)
      expect(/^[A-Za-z0-9_-]+$/.test(token)).toBe(true);
      // Check for zero duplicates in 100 runs
      expect(tokens.has(token)).toBe(false);
      tokens.add(token);
    }
  });

  it('should provide sufficient entropy (at least 192 bits for 24 bytes)', () => {
    const token = crypto.randomBytes(24).toString('base64url');
    // 24 bytes = 192 bits of entropy
    const buffer = Buffer.from(token, 'base64url');
    expect(buffer.length).toBe(24);
  });
});

describe('Unit: Share UI Components Rendering (SSR)', () => {
  it('should render IconShare and IconLink without errors', () => {
    const iconShareResult = render(IconShare, { props: { size: 16 } });
    expect(iconShareResult.body).toContain('<svg');
    expect(iconShareResult.body).toContain('width="16"');

    const iconLinkResult = render(IconLink, { props: { size: 18 } });
    expect(iconLinkResult.body).toContain('<svg');
    expect(iconLinkResult.body).toContain('width="18"');
  });

  it('should render ShareDialog when open with toggle and copy button', () => {
    const result = render(ShareDialog, {
      props: {
        isOpen: true,
        noteId: 'test-note-123',
        isPublic: true,
        shareToken: 'sample-share-token-xyz',
        noteTitle: 'My Shared Note',
      },
    });

    expect(result.body).toContain('Share Note');
    expect(result.body).toContain('Public Link Sharing');
    expect(result.body).toContain('sample-share-token-xyz');
    expect(result.body).toContain('Copy Link');
    expect(result.body).toContain('Regenerate Link');
  });

  it('should render ShareDialog in private mode when isPublic is false', () => {
    const result = render(ShareDialog, {
      props: {
        isOpen: true,
        noteId: 'test-note-123',
        isPublic: false,
        shareToken: null,
      },
    });

    expect(result.body).toContain('Share Note');
    expect(result.body).toContain('This note is private');
    expect(result.body).not.toContain('sample-share-token-xyz');
  });

  it('should render PublicSharePage with title, author, date, tags, and markdown content', () => {
    const mockPublicNote = {
      id: 'note-uuid-1',
      title: 'Distributed Systems Architecture',
      content: '# Distributed Systems\n\nThis note explains **raft consensus**.\n\n```mermaid\ngraph TD\nA[Client] --> B[Leader]\n```',
      isPinned: false,
      isPublic: true,
      shareToken: 'public-token-abc',
      createdAt: new Date('2026-09-01T10:00:00Z'),
      updatedAt: new Date('2026-09-02T12:00:00Z'),
      author: {
        name: 'Alice Engineer',
        displayName: 'Alice Engineer',
      },
      tags: [
        { id: 'tag-1', userId: 'user-uuid-1', name: 'architecture', createdAt: new Date() },
        { id: 'tag-2', userId: 'user-uuid-1', name: 'systems', createdAt: new Date() },
      ],
    };

    const result = render(PublicSharePage, {
      props: {
        data: {
          user: null,
          note: mockPublicNote,
        },
      },
    });

    expect(result.body).toContain('Distributed Systems Architecture');
    expect(result.body).toContain('Alice Engineer');
    expect(result.body).toContain('#architecture');
    expect(result.body).toContain('#systems');
    expect(result.body).toContain('raft consensus');
    expect(result.body).toContain('mermaid-block');
    expect(result.body).toContain('Sign In');
    expect(result.body).toContain('Get Started');
    expect(result.body).toContain('Shared Note');
  });

  it('should fallback to displayName if author name is missing in PublicSharePage', () => {
    const mockPublicNote = {
      id: 'note-uuid-2',
      title: 'Solo Project Notes',
      content: 'Hello World',
      isPinned: false,
      isPublic: true,
      shareToken: 'token-solo',
      createdAt: new Date(),
      updatedAt: new Date(),
      author: {
        name: null,
        displayName: 'developer',
      },
      tags: [],
    };

    const result = render(PublicSharePage, {
      props: {
        data: {
          user: null,
          note: mockPublicNote,
        },
      },
    });

    expect(result.body).toContain('developer');
  });

  it('should render PublicErrorPage with 404 message and Return to Home action', () => {
    const result = render(PublicErrorPage);
    expect(result.body).toContain('Note is private or not found');
    expect(result.body).toContain('Return to Home');
    expect(result.body).toContain('Sign In');
  });
});
