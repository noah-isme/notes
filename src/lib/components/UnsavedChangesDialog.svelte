<script lang="ts">
  import { IconAlertCircle } from './icons';

  interface UnsavedDialogProps {
    isOpen?: boolean;
    title?: string;
    message?: string;
    isSaving?: boolean;
    onStay?: () => void;
    onDiscard?: () => void;
    onSave?: () => void;
  }

  let {
    isOpen = false,
    title = 'Unsaved Changes',
    message = 'You have unsaved changes in this note. What would you like to do before leaving?',
    isSaving = false,
    onStay,
    onDiscard,
    onSave,
  }: UnsavedDialogProps = $props();

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget && !isSaving) {
      onStay?.();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!isOpen) return;
    if (e.key === 'Escape' && !isSaving) {
      e.preventDefault();
      onStay?.();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
  <div
    class="modal-backdrop"
    onclick={handleBackdropClick}
    role="presentation"
  >
    <div
      class="modal-card"
      role="dialog"
      aria-modal="true"
      aria-labelledby="unsaved-dialog-title"
      aria-describedby="unsaved-dialog-desc"
    >
      <div class="modal-body">
        <div class="modal-icon-wrapper">
          <IconAlertCircle size={24} />
        </div>
        <div class="modal-text-group">
          <h3 id="unsaved-dialog-title" class="modal-title">{title}</h3>
          <p id="unsaved-dialog-desc" class="modal-description">{message}</p>
        </div>
      </div>

      <div class="modal-actions">
        <button
          type="button"
          class="btn-stay"
          onclick={() => onStay?.()}
          disabled={isSaving}
        >
          Stay
        </button>
        <button
          type="button"
          class="btn-discard"
          onclick={() => onDiscard?.()}
          disabled={isSaving}
        >
          Discard
        </button>
        <button
          type="button"
          class="btn-save"
          onclick={() => onSave?.()}
          disabled={isSaving}
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.45);
    backdrop-filter: blur(2px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
    animation: fadeIn 0.15s ease-out;
  }

  .modal-card {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
    width: 100%;
    max-width: 440px;
    padding: 1.5rem;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    animation: scaleIn 0.15s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .modal-body {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
  }

  .modal-icon-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: #fef3c7;
    color: #d97706;
    flex-shrink: 0;
  }

  .modal-text-group {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .modal-title {
    margin: 0;
    font-size: 1.0625rem;
    font-weight: 700;
    color: #0f172a;
  }

  .modal-description {
    margin: 0;
    font-size: 0.875rem;
    color: #64748b;
    line-height: 1.45;
  }

  .modal-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.625rem;
  }

  .btn-stay {
    background: #f8fafc;
    border: 1px solid #cbd5e1;
    color: #475569;
    font-size: 0.875rem;
    font-weight: 500;
    padding: 0.5rem 0.875rem;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-stay:hover:not(:disabled) {
    background: #f1f5f9;
    color: #0f172a;
  }

  .btn-discard {
    background: #fef2f2;
    border: 1px solid #fecaca;
    color: #dc2626;
    font-size: 0.875rem;
    font-weight: 600;
    padding: 0.5rem 0.875rem;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-discard:hover:not(:disabled) {
    background: #fee2e2;
  }

  .btn-save {
    background: #2563eb;
    border: 1px solid transparent;
    color: #ffffff;
    font-size: 0.875rem;
    font-weight: 600;
    padding: 0.5rem 1.125rem;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .btn-save:hover:not(:disabled) {
    background: #1d4ed8;
  }

  .btn-stay:disabled,
  .btn-discard:disabled,
  .btn-save:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes scaleIn {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
</style>
