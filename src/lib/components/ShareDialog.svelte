<script lang="ts">
  import { toast } from '$lib/stores/toast.svelte';
  import {
    IconClose,
    IconCopy,
    IconCheck,
    IconRotateCcw,
    IconLink,
    IconAlert,
    IconSpinner,
  } from './icons';

  interface Props {
    isOpen?: boolean;
    noteId?: string;
    isPublic?: boolean;
    shareToken?: string | null;
    noteTitle?: string;
    onClose?: () => void;
    onShareStateChange?: (data: {
      isPublic: boolean;
      shareToken: string | null;
      shareUrl: string | null;
    }) => void;
  }

  let {
    isOpen = false,
    noteId = '',
    isPublic = false,
    shareToken = null,
    noteTitle = '',
    onClose,
    onShareStateChange,
  }: Props = $props();

  let isLoading = $state(false);
  let isCopied = $state(false);
  let showRegenerateConfirm = $state(false);
  let errorMessage = $state<string | null>(null);

  // Derive origin and full share URL
  let origin = $derived.by(() => {
    if (typeof window !== 'undefined') {
      return window.location.origin;
    }
    return '';
  });

  let shareUrl = $derived.by(() => {
    if (shareToken) {
      return `${origin}/share/${shareToken}`;
    }
    return '';
  });

  async function handleToggleShare(e: Event) {
    const target = e.target as HTMLInputElement;
    const shouldEnable = target.checked;
    if (!noteId) return;

    isLoading = true;
    errorMessage = null;

    try {
      if (shouldEnable) {
        const res = await fetch(`/api/notes/${noteId}/share`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to enable sharing');
        }

        const data = await res.json();
        toast.success('Public sharing enabled');
        onShareStateChange?.({
          isPublic: true,
          shareToken: data.shareToken,
          shareUrl: data.shareUrl,
        });
      } else {
        const res = await fetch(`/api/notes/${noteId}/share`, {
          method: 'DELETE',
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to disable sharing');
        }

        const data = await res.json();
        toast.success('Public sharing disabled');
        onShareStateChange?.({
          isPublic: false,
          shareToken: data.shareToken,
          shareUrl: null,
        });
      }
    } catch (err: any) {
      errorMessage = err?.message || 'Error updating share settings';
      toast.error(errorMessage || 'Failed to update share settings');
      target.checked = !shouldEnable;
    } finally {
      isLoading = false;
    }
  }

  async function handleCopyLink() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      isCopied = true;
      toast.success('Link copied to clipboard');
      setTimeout(() => {
        isCopied = false;
      }, 2000);
    } catch {
      toast.error('Failed to copy link to clipboard');
    }
  }

  async function handleRegenerateToken() {
    if (!noteId) return;
    isLoading = true;
    errorMessage = null;

    try {
      const res = await fetch(`/api/notes/${noteId}/share`, {
        method: 'PATCH',
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to regenerate share link');
      }

      const data = await res.json();
      showRegenerateConfirm = false;
      toast.success('Share link regenerated successfully');
      onShareStateChange?.({
        isPublic: true,
        shareToken: data.shareToken,
        shareUrl: data.shareUrl,
      });
    } catch (err: any) {
      errorMessage = err?.message || 'Failed to regenerate link';
      toast.error(errorMessage || 'Failed to regenerate link');
    } finally {
      isLoading = false;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      if (showRegenerateConfirm) {
        showRegenerateConfirm = false;
      } else {
        onClose?.();
      }
    }
  }
</script>

<svelte:window onkeydown={isOpen ? handleKeydown : undefined} />

{#if isOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    class="modal-backdrop"
    onclick={onClose}
    role="presentation"
  >
    <div
      class="dialog-card"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-dialog-title"
      tabindex="-1"
      onclick={(e) => e.stopPropagation()}
    >
      <!-- Dialog Header -->
      <div class="dialog-header">
        <div class="header-title-group">
          <div class="header-icon-wrapper">
            <IconLink size={16} />
          </div>
          <h2 id="share-dialog-title" class="dialog-title">Share Note</h2>
        </div>
        <button
          type="button"
          class="dialog-close-btn"
          onclick={onClose}
          aria-label="Close share dialog"
        >
          <IconClose size={16} />
        </button>
      </div>

      <!-- Dialog Body -->
      <div class="dialog-body">
        {#if errorMessage}
          <div class="alert-error" role="alert">
            <IconAlert size={14} />
            <span>{errorMessage}</span>
          </div>
        {/if}

        <!-- Toggle Row -->
        <div class="share-toggle-row">
          <div class="toggle-text">
            <span class="toggle-label">Public Link Sharing</span>
            <span class="toggle-subtext">
              Anyone with this link can view this note without logging in.
            </span>
          </div>

          <label class="switch-container">
            <input
              type="checkbox"
              checked={isPublic}
              disabled={isLoading}
              onchange={handleToggleShare}
              aria-label="Toggle public link sharing"
            />
            <span class="switch-slider"></span>
          </label>
        </div>

        {#if isPublic}
          <!-- Share URL Section -->
          <div class="share-url-section">
            <label for="share-url-input" class="url-input-label">Share Link</label>
            <div class="url-input-container">
              <input
                id="share-url-input"
                type="text"
                readonly
                value={shareUrl}
                class="url-input"
                onclick={(e) => (e.target as HTMLInputElement).select()}
              />
              <button
                type="button"
                class="btn-copy-link {isCopied ? 'copied' : ''}"
                onclick={handleCopyLink}
                title="Copy share link to clipboard"
                aria-label="Copy share link"
              >
                {#if isCopied}
                  <IconCheck size={14} />
                  <span>Copied!</span>
                {:else}
                  <IconCopy size={14} />
                  <span>Copy Link</span>
                {/if}
              </button>
            </div>
          </div>

          <!-- Regenerate Section -->
          <div class="regenerate-section">
            {#if showRegenerateConfirm}
              <div class="regenerate-confirm-box" role="alert">
                <p class="confirm-message">
                  <strong>Are you sure?</strong> Any previously shared links will stop working immediately.
                </p>
                <div class="confirm-actions">
                  <button
                    type="button"
                    class="btn-confirm-regenerate"
                    onclick={handleRegenerateToken}
                    disabled={isLoading}
                  >
                    {#if isLoading}
                      <IconSpinner size={13} />
                      <span>Regenerating...</span>
                    {:else}
                      <span>Yes, Regenerate</span>
                    {/if}
                  </button>
                  <button
                    type="button"
                    class="btn-cancel-regenerate"
                    onclick={() => (showRegenerateConfirm = false)}
                    disabled={isLoading}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            {:else}
              <div class="regenerate-prompt">
                <span class="regenerate-desc">Need a new link? Previous links will become invalid.</span>
                <button
                  type="button"
                  class="btn-regenerate"
                  onclick={() => (showRegenerateConfirm = true)}
                  disabled={isLoading}
                >
                  <IconRotateCcw size={13} />
                  <span>Regenerate Link</span>
                </button>
              </div>
            {/if}
          </div>
        {:else}
          <div class="private-status-info">
            <span class="status-dot"></span>
            <span>This note is private. Only you can view and edit it.</span>
          </div>
        {/if}
      </div>

      <!-- Dialog Footer -->
      <div class="dialog-footer">
        <button type="button" class="btn-done" onclick={onClose}>
          Done
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 9999;
    background: rgba(15, 23, 42, 0.6);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    animation: fadeIn 0.15s ease-out;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .dialog-card {
    background: #ffffff;
    border-radius: 12px;
    width: 100%;
    max-width: 520px;
    box-shadow:
      0 20px 25px -5px rgba(0, 0, 0, 0.1),
      0 10px 10px -5px rgba(0, 0, 0, 0.04);
    border: 1px solid #e2e8f0;
    overflow: hidden;
    outline: none;
    animation: slideUp 0.15s ease-out;
  }

  @keyframes slideUp {
    from {
      transform: translateY(8px) scale(0.98);
    }
    to {
      transform: translateY(0) scale(1);
    }
  }

  .dialog-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.125rem 1.5rem;
    border-bottom: 1px solid #f1f5f9;
  }

  .header-title-group {
    display: flex;
    align-items: center;
    gap: 0.625rem;
  }

  .header-icon-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    background: #eff6ff;
    color: #2563eb;
  }

  .dialog-title {
    font-size: 1.125rem;
    font-weight: 700;
    color: #0f172a;
    margin: 0;
  }

  .dialog-close-btn {
    background: none;
    border: none;
    color: #64748b;
    padding: 0.375rem;
    border-radius: 6px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .dialog-close-btn:hover {
    color: #0f172a;
    background: #f1f5f9;
  }

  .dialog-body {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .alert-error {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: #fef2f2;
    border: 1px solid #fecaca;
    color: #b91c1c;
    padding: 0.625rem 0.875rem;
    border-radius: 6px;
    font-size: 0.8125rem;
  }

  .share-toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.75rem 1rem;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
  }

  .toggle-text {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .toggle-label {
    font-size: 0.9375rem;
    font-weight: 600;
    color: #0f172a;
  }

  .toggle-subtext {
    font-size: 0.8125rem;
    color: #64748b;
    line-height: 1.4;
  }

  /* Switch Toggle styling */
  .switch-container {
    position: relative;
    display: inline-block;
    width: 44px;
    height: 24px;
    flex-shrink: 0;
  }

  .switch-container input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .switch-slider {
    position: absolute;
    cursor: pointer;
    inset: 0;
    background-color: #cbd5e1;
    transition: 0.2s;
    border-radius: 24px;
  }

  .switch-slider:before {
    position: absolute;
    content: '';
    height: 18px;
    width: 18px;
    left: 3px;
    bottom: 3px;
    background-color: white;
    transition: 0.2s;
    border-radius: 50%;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  }

  .switch-container input:checked + .switch-slider {
    background-color: #10b981;
  }

  .switch-container input:focus-visible + .switch-slider {
    box-shadow: 0 0 0 2px #2563eb;
  }

  .switch-container input:checked + .switch-slider:before {
    transform: translateX(20px);
  }

  /* Share URL section */
  .share-url-section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .url-input-label {
    font-size: 0.8125rem;
    font-weight: 600;
    color: #475569;
  }

  .url-input-container {
    display: flex;
    gap: 0.5rem;
  }

  .url-input {
    flex: 1;
    min-width: 0;
    padding: 0.5rem 0.75rem;
    background: #f8fafc;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 0.8125rem;
    color: #0f172a;
    outline: none;
  }

  .url-input:focus {
    border-color: #2563eb;
    background: #ffffff;
  }

  .btn-copy-link {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    background: #0f172a;
    color: #ffffff;
    border: none;
    padding: 0.5rem 0.875rem;
    border-radius: 6px;
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.15s ease;
  }

  .btn-copy-link:hover {
    background: #1e293b;
  }

  .btn-copy-link.copied {
    background: #059669;
  }

  /* Regenerate section */
  .regenerate-section {
    border-top: 1px solid #f1f5f9;
    padding-top: 1rem;
  }

  .regenerate-prompt {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .regenerate-desc {
    font-size: 0.75rem;
    color: #64748b;
  }

  .btn-regenerate {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    background: transparent;
    color: #475569;
    border: 1px solid #cbd5e1;
    padding: 0.375rem 0.625rem;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.15s ease;
  }

  .btn-regenerate:hover:not(:disabled) {
    background: #f8fafc;
    color: #0f172a;
    border-color: #94a3b8;
  }

  .regenerate-confirm-box {
    background: #fffbeb;
    border: 1px solid #fef3c7;
    border-radius: 8px;
    padding: 0.875rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
  }

  .confirm-message {
    font-size: 0.8125rem;
    color: #92400e;
    margin: 0;
  }

  .confirm-actions {
    display: flex;
    gap: 0.5rem;
  }

  .btn-confirm-regenerate {
    background: #d97706;
    color: #ffffff;
    border: none;
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.375rem 0.75rem;
    border-radius: 4px;
    cursor: pointer;
  }

  .btn-confirm-regenerate:hover:not(:disabled) {
    background: #b45309;
  }

  .btn-cancel-regenerate {
    background: #ffffff;
    color: #475569;
    border: 1px solid #d1d5db;
    font-size: 0.75rem;
    font-weight: 500;
    padding: 0.375rem 0.625rem;
    border-radius: 4px;
    cursor: pointer;
  }

  /* Private status indicator */
  .private-status-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8125rem;
    color: #64748b;
    padding: 0.5rem 0;
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #94a3b8;
  }

  .dialog-footer {
    display: flex;
    justify-content: flex-end;
    padding: 1rem 1.5rem;
    background: #f8fafc;
    border-top: 1px solid #f1f5f9;
  }

  .btn-done {
    background: #0f172a;
    color: #ffffff;
    border: none;
    font-size: 0.875rem;
    font-weight: 600;
    padding: 0.5rem 1.25rem;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .btn-done:hover {
    background: #1e293b;
  }
</style>
