<script lang="ts">
  import { toast } from '$lib/stores/toast.svelte';
  import { IconCheck, IconAlert, IconNote, IconClose } from './icons';
</script>

{#if toast.toasts.length > 0}
  <div class="toast-container" role="region" aria-label="Notifications" aria-live="polite">
    {#each toast.toasts as item (item.id)}
      <div class="toast-card {item.type}">
        <span class="toast-icon" aria-hidden="true">
          {#if item.type === 'success'}
            <IconCheck size={14} />
          {:else if item.type === 'error'}
            <IconAlert size={14} />
          {:else}
            <IconNote size={14} />
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
          <IconClose size={13} />
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
    padding: 0.75rem 1rem;
    background: #ffffff;
    border-radius: 8px;
    box-shadow:
      0 4px 6px -1px rgba(0, 0, 0, 0.07),
      0 2px 4px -2px rgba(0, 0, 0, 0.05);
    border: 1px solid #e2e8f0;
    border-left: 3px solid #2563eb;
    animation: toast-in 0.15s ease-out;
  }

  @keyframes toast-in {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
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
    border-left-color: #2563eb;
  }

  .toast-card.info .toast-icon {
    color: #2563eb;
    background: #eff6ff;
  }

  .toast-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .toast-content {
    flex: 1;
    min-width: 0;
  }

  .toast-message {
    margin: 0;
    font-size: 0.8125rem;
    font-weight: 500;
    color: #0f172a;
    line-height: 1.4;
    word-break: break-word;
  }

  .toast-close {
    background: none;
    border: none;
    color: #94a3b8;
    padding: 0.25rem;
    cursor: pointer;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.15s ease, background 0.15s ease;
  }

  .toast-close:hover {
    color: #0f172a;
    background: #f1f5f9;
  }
</style>
