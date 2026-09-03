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
</style>
