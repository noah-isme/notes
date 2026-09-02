<script lang="ts">
  import type { PageData } from './$types';
  import MarkdownViewer from '$lib/components/MarkdownViewer.svelte';
  import {
    IconNote,
    IconUser,
    IconTag,
  } from '$lib/components/icons';

  let { data }: { data: PageData } = $props();

  let formattedDate = $derived.by(() => {
    if (!data.note?.updatedAt) return '';
    try {
      const d = new Date(data.note.updatedAt);
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return '';
    }
  });

  let authorDisplayName = $derived.by(() => {
    if (data.note?.author?.name && data.note.author.name.trim()) {
      return data.note.author.name.trim();
    }
    if (data.note?.author?.email) {
      return data.note.author.email.split('@')[0];
    }
    return 'Anonymous';
  });
</script>

<svelte:head>
  <title>{data.note.title ? `${data.note.title} — Notes` : 'Public Note — Notes'}</title>
  <meta name="description" content={`Read "${data.note.title}" on Notes.`} />
</svelte:head>

<div class="public-share-layout">
  <!-- Top Navigation Header -->
  <header class="public-header">
    <div class="header-container">
      <a href="/" class="brand-logo" title="Notes Home">
        <span class="brand-icon">
          <IconNote size={18} />
        </span>
        <span class="brand-text">Notes</span>
      </a>

      <div class="header-actions">
        <a href="/login" class="btn-signin">Sign In</a>
        <a href="/register" class="btn-get-started">Get Started</a>
      </div>
    </div>
  </header>

  <!-- Reading Container -->
  <main class="reading-main">
    <article class="note-article">
      <!-- Article Header -->
      <header class="article-header">
        <div class="public-badge-pill" role="status" aria-label="Public shared note">
          <span class="public-dot" aria-hidden="true"></span>
          <span>Shared Note</span>
        </div>

        <h1 class="article-title">{data.note.title || 'Untitled Note'}</h1>

        <div class="article-meta">
          <div class="meta-author" title="Author">
            <span class="author-avatar" aria-hidden="true">
              <IconUser size={14} />
            </span>
            <span class="author-name">{authorDisplayName}</span>
          </div>

          {#if formattedDate}
            <span class="meta-separator" aria-hidden="true">&bull;</span>
            <time datetime={new Date(data.note.updatedAt).toISOString()} class="meta-date">
              Updated {formattedDate}
            </time>
          {/if}
        </div>

        {#if data.note.tags && data.note.tags.length > 0}
          <div class="article-tags" aria-label="Tags">
            {#each data.note.tags as tag (tag.id || tag.name)}
              <span class="tag-chip">
                <IconTag size={11} />
                <span>#{tag.name}</span>
              </span>
            {/each}
          </div>
        {/if}
      </header>

      <hr class="article-divider" />

      <!-- Article Content -->
      <div class="article-body">
        <MarkdownViewer content={data.note.content} showControls={true} />
      </div>
    </article>
  </main>

  <!-- Public Footer -->
  <footer class="public-footer">
    <div class="footer-content">
      <p class="footer-tagline">
        Published with <strong>Notes</strong> &mdash; Fast, distraction-free markdown notes with Mermaid diagrams.
      </p>
      <a href="/register" class="footer-cta-link">Create your own notes &rarr;</a>
    </div>
  </footer>
</div>

<style>
  :global(body) {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu,
      Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
    background-color: #f8fafc;
    color: #0f172a;
    -webkit-font-smoothing: antialiased;
  }

  .public-share-layout {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background-color: #f8fafc;
  }

  /* Public Header */
  .public-header {
    background: #ffffff;
    border-bottom: 1px solid #e2e8f0;
    position: sticky;
    top: 0;
    z-index: 50;
    padding: 0.75rem 1.5rem;
  }

  .header-container {
    max-width: 860px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .brand-logo {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1.125rem;
    font-weight: 700;
    color: #0f172a;
    text-decoration: none;
    letter-spacing: -0.01em;
  }

  .brand-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: #0f172a;
    color: #ffffff;
    border-radius: 6px;
  }

  .brand-text {
    font-size: 1.0625rem;
    font-weight: 700;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .btn-signin {
    color: #475569;
    text-decoration: none;
    font-size: 0.875rem;
    font-weight: 500;
    padding: 0.375rem 0.75rem;
    border-radius: 6px;
    transition: all 0.15s ease;
  }

  .btn-signin:hover {
    color: #0f172a;
    background: #f1f5f9;
  }

  .btn-get-started {
    background: #0f172a;
    color: #ffffff;
    text-decoration: none;
    font-size: 0.875rem;
    font-weight: 600;
    padding: 0.375rem 0.875rem;
    border-radius: 6px;
    transition: background 0.15s ease;
  }

  .btn-get-started:hover {
    background: #1e293b;
  }

  /* Main Reading Container */
  .reading-main {
    flex: 1;
    max-width: 860px;
    width: 100%;
    margin: 0 auto;
    padding: 2rem 1.5rem 4rem;
    box-sizing: border-box;
  }

  .note-article {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 2.5rem 2.5rem 3rem;
    box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05);
    box-sizing: border-box;
  }

  @media (max-width: 640px) {
    .reading-main {
      padding: 1rem 0.75rem 3rem;
    }

    .note-article {
      padding: 1.5rem 1.25rem 2rem;
      border-radius: 8px;
    }
  }

  /* Article Header */
  .article-header {
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
  }

  .public-badge-pill {
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.2rem 0.6rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: #047857;
    background: #ecfdf5;
    border: 1px solid #a7f3d0;
    border-radius: 9999px;
  }

  .public-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: #10b981;
  }

  .article-title {
    font-size: 2rem;
    font-weight: 800;
    line-height: 1.25;
    color: #0f172a;
    letter-spacing: -0.02em;
    margin: 0;
    word-break: break-word;
  }

  @media (max-width: 640px) {
    .article-title {
      font-size: 1.5rem;
    }
  }

  .article-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: #64748b;
  }

  .meta-author {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    font-weight: 500;
    color: #334155;
  }

  .author-avatar {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: #e2e8f0;
    color: #475569;
  }

  .author-name {
    font-weight: 600;
    color: #1e293b;
  }

  .meta-separator {
    color: #cbd5e1;
  }

  .meta-date {
    color: #64748b;
  }

  .article-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
    margin-top: 0.25rem;
  }

  .tag-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    background: #f1f5f9;
    color: #475569;
    font-size: 0.75rem;
    font-weight: 500;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    border: 1px solid #e2e8f0;
  }

  .article-divider {
    border: none;
    border-top: 1px solid #e2e8f0;
    margin: 1.5rem 0 2rem;
  }

  /* Article Body */
  .article-body {
    font-size: 1rem;
    line-height: 1.7;
    color: #1e293b;
  }

  /* Public Footer */
  .public-footer {
    border-top: 1px solid #e2e8f0;
    background: #ffffff;
    padding: 1.5rem;
    margin-top: auto;
  }

  .footer-content {
    max-width: 860px;
    margin: 0 auto;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    font-size: 0.875rem;
    color: #64748b;
  }

  .footer-tagline {
    margin: 0;
  }

  .footer-cta-link {
    color: #2563eb;
    text-decoration: none;
    font-weight: 600;
    transition: color 0.15s ease;
  }

  .footer-cta-link:hover {
    color: #1d4ed8;
    text-decoration: underline;
  }
</style>
