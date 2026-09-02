<script lang="ts">
  import { toast } from '$lib/stores/toast.svelte';
</script>

{#if toast.toasts.length > 0}
  <div class="toast-container" role="region" aria-label="Notifications" aria-live="polite">
    {#each toast.toasts as item (item.id)}
      <div class="toast-card {item.type}">
        <span class="toast-icon" aria-hidden="true">
          {#if item.type === 'success'}
            ✓
          {:else if item.type === 'error'}
            ⚠
          {:else}
            ℹ
          {/if}
        </span>
        <div class="toast-content">
          <p class="toast-message">{item.message}</p>
        </div>
        <button
          type="button"
          class="toast-close"
          onclick={() => toast.remove(item.id)}
          aria-label="Close notification"
        >
          &times;
        </button>
      </div>
    {/each}
  </div>
{/if}

<style>
  .toast-container {
    position: fixed;
    bottom: 1.5rem;
    right: 1.5rem;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-width: 24rem;
    width: calc(100vw - 3rem);
    pointer-events: none;
  }

  .toast-card {
    pointer-events: auto;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.875rem 1rem;
    background: #ffffff;
    border-radius: 8px;
    box-shadow:
      0 10px 15px -3px rgba(0, 0, 0, 0.1),
      0 4px 6px -4px rgba(0, 0, 0, 0.1);
    border-left: 4px solid #3b82f6;
    animation: toast-in 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes toast-in {
    from {
      opacity: 0;
      transform: translateY(10px) scale(0.96);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .toast-card.success {
    border-left-color: #10b981;
  }

  .toast-card.success .toast-icon {
    color: #10b981;
    background: #ecfdf5;
  }

  .toast-card.error {
    border-left-color: #ef4444;
  }

  .toast-card.error .toast-icon {
    color: #ef4444;
    background: #fef2f2;
  }

  .toast-card.info {
    border-left-color: #3b82f6;
  }

  .toast-card.info .toast-icon {
    color: #3b82f6;
    background: #eff6ff;
  }

  .toast-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    border-radius: 9999px;
    font-size: 0.875rem;
    font-weight: 700;
    flex-shrink: 0;
  }

  .toast-content {
    flex: 1;
    min-width: 0;
  }

  .toast-message {
    margin: 0;
    font-size: 0.875rem;
    font-weight: 500;
    color: #1e293b;
    line-height: 1.4;
    word-break: break-word;
  }

  .toast-close {
    background: none;
    border: none;
    color: #94a3b8;
    font-size: 1.25rem;
    line-height: 1;
    padding: 0.25rem;
    cursor: pointer;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.15s ease, background 0.15s ease;
  }

  .toast-close:hover {
    color: #475569;
    background: #f1f5f9;
  }
</style>
