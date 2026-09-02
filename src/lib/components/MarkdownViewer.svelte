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
    overflow-wrap: break-word;
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
    font-family: ui-monospace, "JetBrains Mono", "IBM Plex Mono", Menlo, Consolas, monospace;
    font-size: 0.8125rem;
    color: #0f172a;
    word-break: break-word;
  }

  :global(.markdown-viewer pre) {
    background: #0f172a;
    color: #f8fafc;
    padding: 0.875rem 1rem;
    border-radius: 6px;
    max-width: 100%;
    overflow-x: auto;
    white-space: pre;
    word-break: normal;
    word-wrap: normal;
    overflow-wrap: normal;
    tab-size: 2;
    -moz-tab-size: 2;
    font-family: ui-monospace, "JetBrains Mono", "IBM Plex Mono", Menlo, Consolas, monospace;
    font-size: 0.8125rem;
    line-height: 1.6;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior-x: contain;
    margin: 0.75rem 0;
  }

  :global(.markdown-viewer pre code) {
    background: transparent;
    color: inherit;
    padding: 0;
    font-family: inherit;
    font-size: inherit;
    line-height: inherit;
    white-space: pre;
    word-break: normal;
    word-wrap: normal;
    overflow-wrap: normal;
    display: block;
    min-width: 100%;
  }

  :global(.markdown-viewer pre::-webkit-scrollbar) {
    height: 6px;
  }

  :global(.markdown-viewer pre::-webkit-scrollbar-track) {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 3px;
  }

  :global(.markdown-viewer pre::-webkit-scrollbar-thumb) {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 3px;
  }

  :global(.markdown-viewer pre::-webkit-scrollbar-thumb:hover) {
    background: rgba(255, 255, 255, 0.35);
  }

  :global(.markdown-viewer blockquote) {
    margin: 0.75rem 0;
    padding-left: 1rem;
    border-left: 4px solid #cbd5e1;
    color: #475569;
    font-style: italic;
  }

  :global(.markdown-viewer .table-container) {
    width: 100%;
    overflow-x: auto;
    margin: 1rem 0;
    -webkit-overflow-scrolling: touch;
    border-radius: 6px;
    border: 1px solid #e2e8f0;
  }

  :global(.markdown-viewer table) {
    width: 100%;
    border-collapse: collapse;
    margin: 0;
    font-size: 0.875rem;
    line-height: 1.5;
  }

  :global(.markdown-viewer th) {
    background: #f1f5f9;
    color: #0f172a;
    font-weight: 600;
    border-bottom: 1px solid #cbd5e1;
    border-right: 1px solid #e2e8f0;
    padding: 0.625rem 0.875rem;
    text-align: left;
    white-space: nowrap;
  }

  :global(.markdown-viewer td) {
    border-bottom: 1px solid #e2e8f0;
    border-right: 1px solid #e2e8f0;
    padding: 0.625rem 0.875rem;
    color: #334155;
    vertical-align: top;
  }

  :global(.markdown-viewer th:last-child, .markdown-viewer td:last-child) {
    border-right: none;
  }

  :global(.markdown-viewer tr:last-child td) {
    border-bottom: none;
  }

  :global(.markdown-viewer tr:nth-child(even)) {
    background: #f8fafc;
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
