<script lang="ts">
  import { renderMarkdown } from '$lib/utils/markdown';
  import { mermaidRenderer } from '$lib/actions/mermaid';

  interface Props {
    content?: string;
    class?: string;
    showControls?: boolean;
  }

  let {
    content = '',
    class: className = '',
    showControls = true,
  }: Props = $props();

  let renderedHtml = $derived(renderMarkdown(content));
</script>

<div
  class="markdown-viewer {className}"
  use:mermaidRenderer={{ showControls, content: renderedHtml }}
>
  {#if renderedHtml}
    <!-- eslint-disable-next-line svelte/no-at-html-tags -->
    {@html renderedHtml}
  {/if}
</div>

<style>
  .markdown-viewer {
    font-size: 0.875rem;
    line-height: 1.6;
    color: #1e293b;
    word-break: break-word;
  }

  :global(.markdown-viewer h1) {
    font-size: 1.5rem;
    font-weight: 700;
    margin-top: 0;
    margin-bottom: 0.75rem;
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 0.375rem;
  }

  :global(.markdown-viewer h2) {
    font-size: 1.25rem;
    font-weight: 600;
    margin-top: 1.25rem;
    margin-bottom: 0.5rem;
  }

  :global(.markdown-viewer h3) {
    font-size: 1.0625rem;
    font-weight: 600;
    margin-top: 1rem;
    margin-bottom: 0.375rem;
  }

  :global(.markdown-viewer p) {
    margin-top: 0;
    margin-bottom: 0.75rem;
  }

  :global(.markdown-viewer ul, .markdown-viewer ol) {
    margin-top: 0;
    margin-bottom: 0.75rem;
    padding-left: 1.5rem;
  }

  :global(.markdown-viewer li) {
    margin-bottom: 0.25rem;
  }

  :global(.markdown-viewer code) {
    background: #f1f5f9;
    padding: 0.125rem 0.375rem;
    border-radius: 4px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 0.8125rem;
    color: #0f172a;
  }

  :global(.markdown-viewer pre) {
    background: #0f172a;
    color: #f8fafc;
    padding: 0.875rem 1rem;
    border-radius: 6px;
    overflow-x: auto;
    margin: 0.75rem 0;
  }

  :global(.markdown-viewer pre code) {
    background: transparent;
    color: inherit;
    padding: 0;
    font-size: 0.8125rem;
  }

  :global(.markdown-viewer blockquote) {
    margin: 0.75rem 0;
    padding-left: 1rem;
    border-left: 4px solid #cbd5e1;
    color: #475569;
    font-style: italic;
  }

  :global(.markdown-viewer table) {
    width: 100%;
    border-collapse: collapse;
    margin: 0.75rem 0;
  }

  :global(.markdown-viewer th, .markdown-viewer td) {
    border: 1px solid #e2e8f0;
    padding: 0.5rem 0.75rem;
    text-align: left;
  }

  :global(.markdown-viewer th) {
    background: #f8fafc;
    font-weight: 600;
  }

  :global(.markdown-viewer a) {
    color: #2563eb;
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  :global(.markdown-viewer a:hover) {
    color: #1d4ed8;
  }
</style>
