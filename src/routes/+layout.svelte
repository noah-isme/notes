<script lang="ts">
  import type { Snippet } from 'svelte';
  import { navigating } from '$app/stores';

  let { children }: { children: Snippet } = $props();
</script>

{#if $navigating}
  <div class="global-loading-bar" role="progressbar" aria-label="Loading page...">
    <div class="loading-bar-indicator"></div>
  </div>
{/if}

{@render children()}

<style>
  .global-loading-bar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    z-index: 99999;
    background: rgba(37, 99, 235, 0.15);
    overflow: hidden;
    pointer-events: none;
  }

  .loading-bar-indicator {
    height: 100%;
    background: #2563eb;
    box-shadow: 0 0 8px rgba(37, 99, 235, 0.6);
    animation: loading-bar 1.2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
  }

  @keyframes loading-bar {
    0% {
      margin-left: -40%;
      width: 40%;
    }
    50% {
      margin-left: 20%;
      width: 60%;
    }
    100% {
      margin-left: 100%;
      width: 40%;
    }
  }

  :global(html) {
    scroll-behavior: smooth;
    -webkit-text-size-adjust: 100%;
    scrollbar-gutter: stable;
  }

  :global(body) {
    -webkit-overflow-scrolling: touch;
  }

  /* Universal Slim Minimalist Scrollbars */
  :global(*),
  :global(*::before),
  :global(*::after) {
    scrollbar-width: thin;
    scrollbar-color: #cbd5e1 transparent;
  }

  :global(*::-webkit-scrollbar) {
    width: 6px;
    height: 6px;
  }

  :global(*::-webkit-scrollbar-track) {
    background: transparent;
  }

  :global(*::-webkit-scrollbar-thumb) {
    background: #cbd5e1;
    border-radius: 9999px;
    transition: background-color 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }

  :global(*::-webkit-scrollbar-thumb:hover) {
    background: #94a3b8;
  }

  :global(*::-webkit-scrollbar-corner) {
    background: transparent;
  }
</style>
