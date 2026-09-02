<script module lang="ts">
  function getPropValue<T>(getter: () => T): T {
    return getter();
  }
</script>

<script lang="ts">
  import { renderMarkdown } from '$lib/utils/markdown';
  import { mermaidRenderer } from '$lib/actions/mermaid';
  import ShareDialog from './ShareDialog.svelte';
  import {
    IconPin,
    IconEdit,
    IconEye,
    IconSplit,
    IconTrash,
    IconAlert,
    IconClose,
    IconMaximize,
    IconShare,
  } from './icons';

  export interface NoteEditorData {
    id?: string;
    title: string;
    content: string;
    isPinned: boolean;
    isPublic?: boolean;
    shareToken?: string | null;
    tags: Array<{ id?: string; name: string }>;
  }

  interface NoteEditorProps {
    note?: NoteEditorData | null;
    isNew?: boolean;
    formError?: string | null;
    isSubmitting?: boolean;
    isDirty?: boolean;
    isFocusMode?: boolean;
    viewMode?: 'edit' | 'preview' | 'split';
    onSave?: (data: {
      id?: string;
      title: string;
      content: string;
      isPinned: boolean;
      tags: string[];
    }) => void;
    onCancel?: () => void;
    onDelete?: (noteId: string) => void;
    onDirtyChange?: (isDirty: boolean) => void;
    onToggleFocusMode?: () => void;
  }

  let {
    note = null,
    isNew = false,
    formError = null,
    isSubmitting = false,
    isDirty = $bindable(false),
    isFocusMode = $bindable(false),
    viewMode = $bindable<'edit' | 'preview' | 'split'>('split'),
    onSave,
    onCancel,
    onDelete,
    onDirtyChange,
    onToggleFocusMode,
  }: NoteEditorProps = $props();

  let title = $state(getPropValue(() => note?.title ?? ''));
  let content = $state(getPropValue(() => note?.content ?? ''));
  let debouncedContent = $state(getPropValue(() => note?.content ?? ''));
  let isPinned = $state(getPropValue(() => note?.isPinned ?? false));
  let isPublic = $state(getPropValue(() => note?.isPublic ?? false));
  let shareToken = $state<string | null>(getPropValue(() => note?.shareToken ?? null));
  let isShareDialogOpen = $state(false);
  let tagList = $state<string[]>(getPropValue(() => (note?.tags ? note.tags.map((t) => t.name) : [])));
  let tagInput = $state('');
  let titleTouched = $state(false);

  // Baseline snapshots for change detection
  let initialTitle = $state(getPropValue(() => note?.title ?? ''));
  let initialContent = $state(getPropValue(() => note?.content ?? ''));
  let initialIsPinned = $state(getPropValue(() => note?.isPinned ?? false));
  let initialTagList = $state<string[]>(getPropValue(() => (note?.tags ? note.tags.map((t) => t.name) : [])));

  function areTagListsEqual(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    const sortedA = [...a].sort();
    const sortedB = [...b].sort();
    return sortedA.every((tag, i) => tag === sortedB[i]);
  }

  // Sync props when selected note changes
  $effect(() => {
    const currentNote = note;
    const currentIsNew = isNew;

    initialTitle = currentNote?.title ?? '';
    initialContent = currentNote?.content ?? '';
    initialIsPinned = currentNote?.isPinned ?? false;
    initialTagList = currentNote?.tags ? currentNote.tags.map((t) => t.name) : [];

    title = initialTitle;
    content = initialContent;
    debouncedContent = initialContent;
    isPinned = initialIsPinned;
    isPublic = currentNote?.isPublic ?? false;
    shareToken = currentNote?.shareToken ?? null;
    tagList = [...initialTagList];
    tagInput = '';
    titleTouched = false;
  });

  // Debounce live markdown preview re-rendering by 200ms
  $effect(() => {
    const currentContent = content;
    const timer = setTimeout(() => {
      debouncedContent = currentContent;
    }, 200);

    return () => {
      clearTimeout(timer);
    };
  });

  // Reactive dirty derived computation
  let isDirtyDerived = $derived.by(() => {
    if (isNew) {
      return (
        title.trim().length > 0 ||
        content.trim().length > 0 ||
        tagList.length > 0 ||
        isPinned
      );
    }
    const titleChanged = title !== initialTitle;
    const contentChanged = content !== initialContent;
    const pinChanged = isPinned !== initialIsPinned;
    const tagsChanged = !areTagListsEqual(tagList, initialTagList);

    return titleChanged || contentChanged || pinChanged || tagsChanged;
  });

  // Sync dirty state to bindable prop and notify callback
  $effect(() => {
    const currentDirty = isDirtyDerived;
    isDirty = currentDirty;
    onDirtyChange?.(currentDirty);
  });

  // Public methods callable via bind:this
  export function getEditorData() {
    return {
      id: note?.id,
      title: title.trim(),
      content,
      isPinned,
      isPublic,
      shareToken,
      tags: tagList,
      isDirty: isDirtyDerived,
      isValid: isTitleValid,
    };
  }

  export async function submitSave(): Promise<{ success: boolean; error?: string; note?: any }> {
    titleTouched = true;
    if (!isTitleValid) {
      return { success: false, error: 'Title is required (1-200 characters)' };
    }

    const formData = new FormData();
    if (note?.id && !isNew) {
      formData.append('id', note.id);
    }
    formData.append('title', title.trim());
    formData.append('content', content);
    formData.append('isPinned', isPinned ? 'true' : 'false');
    formData.append('tags', tagList.join(', '));

    try {
      const action = note?.id && !isNew ? '?/update' : '?/create';
      const response = await fetch(action, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        initialTitle = title.trim();
        initialContent = content;
        initialIsPinned = isPinned;
        initialTagList = [...tagList];
        let savedNote: any = null;
        try {
          const resJson = await response.json();
          if (resJson?.note) {
            savedNote = resJson.note;
          } else if (resJson?.data) {
            const dataObj = typeof resJson.data === 'string' ? JSON.parse(resJson.data) : resJson.data;
            savedNote = dataObj?.note;
          }
        } catch {}
        return { success: true, note: savedNote };
      } else {
        const result = await response.json().catch(() => null);
        return { success: false, error: result?.error || 'Failed to save note' };
      }
    } catch (err: any) {
      return { success: false, error: err?.message || 'Network error while saving' };
    }
  }

  export function resetToBaseline() {
    title = initialTitle;
    content = initialContent;
    isPinned = initialIsPinned;
    tagList = [...initialTagList];
    tagInput = '';
    titleTouched = false;
  }

  let renderedPreview = $derived(renderMarkdown(debouncedContent));
  let titleCharCount = $derived(title.length);
  let isTitleValid = $derived(title.trim().length > 0 && title.trim().length <= 200);
  let tagsFormatted = $derived(tagList.join(', '));

  function addTag(raw: string) {
    const cleaned = raw.replace(/^#/, '').trim();
    if (cleaned && !tagList.includes(cleaned)) {
      tagList = [...tagList, cleaned];
    }
    tagInput = '';
  }

  function removeTag(index: number) {
    tagList = tagList.filter((_, i) => i !== index);
  }

  function handleTagKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
      e.preventDefault();
      addTag(tagInput);
    } else if (e.key === 'Backspace' && tagInput === '' && tagList.length > 0) {
      removeTag(tagList.length - 1);
    }
  }

  function handleTagBlur() {
    if (tagInput.trim()) {
      addTag(tagInput);
    }
  }

  function handleSubmit(e: SubmitEvent) {
    titleTouched = true;
    if (!isTitleValid) {
      e.preventDefault();
      return;
    }
    if (onSave) {
      onSave({
        id: note?.id,
        title: title.trim(),
        content,
        isPinned,
        tags: tagList,
      });
    }
  }

  const viewModes: Array<'edit' | 'split' | 'preview'> = ['edit', 'split', 'preview'];

  function handleViewModeKeyDown(e: KeyboardEvent) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      const idx = viewModes.indexOf(viewMode);
      const nextIdx = (idx + 1) % viewModes.length;
      viewMode = viewModes[nextIdx];
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const idx = viewModes.indexOf(viewMode);
      const prevIdx = (idx - 1 + viewModes.length) % viewModes.length;
      viewMode = viewModes[prevIdx];
    } else if (e.key === 'Home') {
      e.preventDefault();
      viewMode = 'edit';
    } else if (e.key === 'End') {
      e.preventDefault();
      viewMode = 'preview';
    }
  }

  function handleToggleFocus() {
    isFocusMode = !isFocusMode;
    onToggleFocusMode?.();
  }

  function handleDelete() {
    if (note?.id && onDelete) {
      onDelete(note.id);
    }
  }
</script>

<div class="note-editor-wrapper">
  {#if formError}
    <div class="alert-error" role="alert">
      <IconAlert size={16} />
      <span>{formError}</span>
    </div>
  {/if}

  <form
    method="POST"
    action={note?.id && !isNew ? '?/update' : '?/create'}
    class="editor-form"
    onsubmit={handleSubmit}
  >
    {#if note?.id && !isNew}
      <input type="hidden" name="id" value={note.id} />
    {/if}

    <!-- Hidden values for Form Action compatibility -->
    <input type="hidden" name="tags" value={tagsFormatted} />
    <input type="hidden" name="isPinned" value={isPinned ? 'true' : 'false'} />

    <!-- Top Toolbar: Title & Meta Controls -->
    <div class="editor-header">
      <div class="title-input-group">
        <input
          type="text"
          name="title"
          class="title-input {titleTouched && !isTitleValid ? 'invalid' : ''}"
          placeholder="Note title..."
          bind:value={title}
          onblur={() => (titleTouched = true)}
          maxlength="200"
          required
          aria-label="Note Title"
        />
        <span class="char-count {titleCharCount > 200 ? 'overflow' : ''}">
          {titleCharCount}/200
        </span>
      </div>

      <div class="top-controls">
        {#if isDirtyDerived}
          <span class="unsaved-badge" role="status" aria-label="Unsaved changes">
            <span class="unsaved-dot" aria-hidden="true">●</span>
            <span>Unsaved changes</span>
          </span>
        {/if}

        <label class="pin-toggle-btn {isPinned ? 'pinned' : ''}" title={isPinned ? 'Unpin note' : 'Pin note'}>
          <input
            type="checkbox"
            checked={isPinned}
            onchange={(e) => (isPinned = (e.target as HTMLInputElement).checked)}
            class="sr-only"
          />
          <IconPin size={13} filled={isPinned} />
          <span>{isPinned ? 'Pinned' : 'Pin'}</span>
        </label>

        {#if note?.id && !isNew}
          <button
            type="button"
            class="share-toggle-btn {isPublic ? 'is-shared' : ''}"
            onclick={() => (isShareDialogOpen = true)}
            title={isPublic ? 'Public sharing enabled (click to manage)' : 'Share note'}
            aria-label={isPublic ? 'Public sharing enabled' : 'Share note'}
            data-testid="share-note-btn"
          >
            <IconShare size={13} />
            <span>{isPublic ? 'Shared' : 'Share'}</span>
          </button>
        {/if}

        <!-- View Mode Switcher -->
        <div
          class="view-mode-tabs segmented-control"
          role="tablist"
          aria-label="Editor View Modes"
        >
          <button
            type="button"
            class="mode-btn {viewMode === 'edit' ? 'active' : ''} btn-segmented"
            onclick={() => (viewMode = 'edit')}
            onkeydown={handleViewModeKeyDown}
            role="tab"
            aria-selected={viewMode === 'edit'}
            tabindex={viewMode === 'edit' ? 0 : -1}
            title="Edit mode"
            data-testid="mode-edit"
          >
            <IconEdit size={13} />
            <span>Edit</span>
          </button>
          <button
            type="button"
            class="mode-btn {viewMode === 'split' ? 'active' : ''} btn-segmented"
            onclick={() => (viewMode = 'split')}
            onkeydown={handleViewModeKeyDown}
            role="tab"
            aria-selected={viewMode === 'split'}
            tabindex={viewMode === 'split' ? 0 : -1}
            title="Split mode"
            data-testid="mode-split"
          >
            <IconSplit size={13} />
            <span>Split</span>
          </button>
          <button
            type="button"
            class="mode-btn {viewMode === 'preview' ? 'active' : ''} btn-segmented"
            onclick={() => (viewMode = 'preview')}
            onkeydown={handleViewModeKeyDown}
            role="tab"
            aria-selected={viewMode === 'preview'}
            tabindex={viewMode === 'preview' ? 0 : -1}
            title="Preview mode"
            data-testid="mode-preview"
          >
            <IconEye size={13} />
            <span>Preview</span>
          </button>
        </div>

        <!-- Focus / Fullscreen Mode Toggle -->
        <button
          type="button"
          class="focus-toggle-btn {isFocusMode ? 'active' : ''}"
          onclick={handleToggleFocus}
          title={isFocusMode ? 'Exit focus mode (Esc)' : 'Enter focus mode'}
          aria-label={isFocusMode ? 'Exit focus mode' : 'Enter focus mode'}
          aria-pressed={isFocusMode}
          data-testid="toggle-focus-mode"
        >
          <IconMaximize size={13} />
          <span>{isFocusMode ? 'Exit Focus' : 'Focus'}</span>
        </button>
      </div>
    </div>

    <!-- Tags Management Row -->
    <div class="tags-manager-row">
      <span class="tag-label">Tags:</span>
      <div class="tag-chips-container">
        {#each tagList as tag, idx (tag + idx)}
          <span class="tag-chip">
            #{tag}
            <button
              type="button"
              class="tag-remove-btn"
              onclick={() => removeTag(idx)}
              aria-label={`Remove tag ${tag}`}
            >
              <IconClose size={10} />
            </button>
          </span>
        {/each}
        <input
          type="text"
          class="tag-inline-input"
          placeholder="Add tag (press Enter)..."
          bind:value={tagInput}
          onkeydown={handleTagKeyDown}
          onblur={handleTagBlur}
        />
      </div>
    </div>

    <!-- Workspace Body: Edit, Preview, or Split -->
    <div class="editor-workspace {viewMode}">
      {#if viewMode === 'edit' || viewMode === 'split'}
        <div class="workspace-pane editor-pane">
          <textarea
            name="content"
            class="markdown-textarea"
            placeholder="Write your note in Markdown...

# Heading 1
- Lists
**bold**, *italic*, `code`

```typescript
// code blocks supported
```"
            bind:value={content}
            aria-label="Markdown Content"
          ></textarea>
        </div>
      {/if}

      {#if viewMode === 'preview' || viewMode === 'split'}
        <div class="workspace-pane preview-pane" role="region" aria-label="Markdown Preview">
          {#if renderedPreview}
            <div class="markdown-preview" use:mermaidRenderer={renderedPreview}>
              <!-- eslint-disable-next-line svelte/no-at-html-tags -->
              {@html renderedPreview}
            </div>
          {:else}
            <div class="empty-preview">
              <em>Markdown preview will appear here as you type...</em>
            </div>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Bottom Actions Toolbar -->
    <div class="editor-footer">
      <div class="footer-left">
        {#if note?.id && onDelete}
          <button
            type="button"
            class="btn-danger"
            onclick={handleDelete}
            disabled={isSubmitting}
          >
            <IconTrash size={14} />
            <span>Delete Note</span>
          </button>
        {/if}
      </div>

      <div class="footer-right">
        {#if onCancel}
          <button
            type="button"
            class="btn-secondary"
            onclick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </button>
        {/if}

        <button
          type="submit"
          class="btn-primary {isDirtyDerived ? 'is-dirty' : ''}"
          disabled={isSubmitting || (titleTouched && !isTitleValid)}
          title={note?.id && !isNew ? 'Save changes (Cmd/Ctrl+S)' : 'Save note (Cmd/Ctrl+S)'}
          aria-label={note?.id && !isNew ? 'Save changes' : 'Save note'}
        >
          {isSubmitting
            ? 'Saving...'
            : note?.id && !isNew
              ? 'Save Changes'
              : 'Create Note'}
        </button>
      </div>
    </div>
  </form>

  {#if note?.id && !isNew}
    <ShareDialog
      isOpen={isShareDialogOpen}
      noteId={note.id}
      isPublic={isPublic}
      shareToken={shareToken}
      noteTitle={title}
      onClose={() => (isShareDialogOpen = false)}
      onShareStateChange={(data) => {
        isPublic = data.isPublic;
        shareToken = data.shareToken;
      }}
    />
  {/if}
</div>

<style>
  .note-editor-wrapper {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    height: 100%;
    box-sizing: border-box;
  }

  .editor-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    height: 100%;
  }

  .alert-error {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: #fef2f2;
    border: 1px solid #fecaca;
    color: #b91c1c;
    padding: 0.75rem 1rem;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .editor-header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .title-input-group {
    position: relative;
    flex: 1;
    min-width: 240px;
    display: flex;
    align-items: center;
  }

  .title-input {
    width: 100%;
    padding: 0.5rem 4rem 0.5rem 0.75rem;
    font-size: 1.125rem;
    font-weight: 600;
    color: #0f172a;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    outline: none;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }

  .title-input:focus {
    border-color: #2563eb;
    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
  }

  .title-input.invalid {
    border-color: #ef4444;
  }

  .char-count {
    position: absolute;
    right: 0.75rem;
    font-size: 0.75rem;
    color: #94a3b8;
    pointer-events: none;
  }

  .char-count.overflow {
    color: #ef4444;
    font-weight: 600;
  }

  .top-controls {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .unsaved-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0.625rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: #b45309;
    background: #fef3c7;
    border: 1px solid #fde68a;
    border-radius: 9999px;
    white-space: nowrap;
    animation: fadeInBadge 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .unsaved-dot {
    font-size: 0.625rem;
    color: #f59e0b;
    line-height: 1;
  }

  @keyframes fadeInBadge {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  .pin-toggle-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.75rem;
    font-size: 0.8125rem;
    font-weight: 500;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    background: #f8fafc;
    color: #475569;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .pin-toggle-btn:hover {
    background: #f1f5f9;
  }

  .pin-toggle-btn.pinned {
    background: #fef3c7;
    border-color: #f59e0b;
    color: #92400e;
    font-weight: 600;
  }

  .share-toggle-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.75rem;
    font-size: 0.8125rem;
    font-weight: 500;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    background: #f8fafc;
    color: #475569;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .share-toggle-btn:hover {
    background: #f1f5f9;
    color: #0f172a;
    border-color: #94a3b8;
  }

  .share-toggle-btn.is-shared {
    background: #ecfdf5;
    border-color: #6ee7b7;
    color: #047857;
    font-weight: 600;
  }

  .share-toggle-btn.is-shared:hover {
    background: #d1fae5;
    border-color: #34d399;
    color: #065f46;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    border: 0;
  }

  .view-mode-tabs {
    display: inline-flex;
    background: #f1f5f9;
    padding: 0.1875rem;
    border-radius: 6px;
    border: 1px solid #cbd5e1;
    gap: 2px;
    align-items: center;
  }

  .mode-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.3125rem;
    background: transparent;
    border: 1px solid transparent;
    padding: 0.25rem 0.625rem;
    font-size: 0.8125rem;
    font-weight: 500;
    color: #64748b;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);
    user-select: none;
  }

  .mode-btn:hover {
    color: #1e293b;
    background: rgba(255, 255, 255, 0.5);
  }

  .mode-btn.active {
    background: #ffffff;
    color: #0f172a;
    font-weight: 600;
    border-color: rgba(15, 23, 42, 0.08);
    box-shadow:
      0 1px 3px rgba(15, 23, 42, 0.1),
      0 1px 2px rgba(15, 23, 42, 0.06);
  }

  .mode-btn:focus-visible {
    outline: 2px solid #2563eb;
    outline-offset: 1px;
  }

  .focus-toggle-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.75rem;
    font-size: 0.8125rem;
    font-weight: 500;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    background: #f8fafc;
    color: #475569;
    cursor: pointer;
    transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .focus-toggle-btn:hover {
    background: #f1f5f9;
    color: #0f172a;
  }

  .focus-toggle-btn.active {
    background: #eff6ff;
    border-color: #2563eb;
    color: #1d4ed8;
    font-weight: 600;
  }

  .focus-toggle-btn:focus-visible {
    outline: 2px solid #2563eb;
    outline-offset: 1px;
  }

  .tags-manager-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.25rem 0;
  }

  .tag-label {
    font-size: 0.8125rem;
    font-weight: 600;
    color: #64748b;
  }

  .tag-chips-container {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.375rem;
    flex: 1;
  }

  .tag-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    background: #f1f5f9;
    color: #334155;
    font-size: 0.75rem;
    font-weight: 500;
    padding: 0.1875rem 0.5rem;
    border-radius: 4px;
    border: 1px solid #e2e8f0;
  }

  .tag-remove-btn {
    background: none;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.15s ease;
  }

  .tag-remove-btn:hover {
    color: #dc2626;
  }

  .tag-inline-input {
    border: none;
    outline: none;
    font-size: 0.8125rem;
    color: #0f172a;
    padding: 0.25rem 0.375rem;
    min-width: 140px;
    flex: 1;
    background: transparent;
  }

  .tag-inline-input::placeholder {
    color: #94a3b8;
  }

  .editor-workspace {
    flex: 1;
    min-height: 380px;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    overflow: hidden;
    display: flex;
  }

  .editor-workspace.split {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }

  .editor-workspace.edit {
    display: flex;
  }

  .editor-workspace.preview {
    display: flex;
  }

  .workspace-pane {
    height: 100%;
    overflow-y: auto;
    box-sizing: border-box;
    min-width: 0;
  }

  .editor-pane {
    display: flex;
    flex-direction: column;
  }

  .editor-workspace.split .editor-pane {
    border-right: 1px solid #e2e8f0;
  }

  .markdown-textarea {
    width: 100%;
    height: 100%;
    min-height: 380px;
    padding: 1rem;
    border: none;
    outline: none;
    resize: none;
    font-family: ui-monospace, "JetBrains Mono", "IBM Plex Mono", Menlo, Consolas, monospace;
    font-size: 0.875rem;
    line-height: 1.6;
    tab-size: 2;
    -moz-tab-size: 2;
    white-space: pre-wrap;
    overflow-wrap: break-word;
    color: #0f172a;
    background: #ffffff;
    box-sizing: border-box;
  }

  .preview-pane {
    padding: 1rem 1.25rem;
    background: #fdfdfd;
  }

  .empty-preview {
    color: #94a3b8;
    font-size: 0.875rem;
    padding: 2rem;
    text-align: center;
  }

  .markdown-preview {
    font-size: 0.875rem;
    line-height: 1.6;
    color: #1e293b;
    word-break: break-word;
    overflow-wrap: break-word;
  }

  :global(.markdown-preview h1) {
    font-size: 1.5rem;
    font-weight: 700;
    margin-top: 0;
    margin-bottom: 0.75rem;
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 0.375rem;
  }

  :global(.markdown-preview h2) {
    font-size: 1.25rem;
    font-weight: 600;
    margin-top: 1.25rem;
    margin-bottom: 0.5rem;
  }

  :global(.markdown-preview h3) {
    font-size: 1.0625rem;
    font-weight: 600;
    margin-top: 1rem;
    margin-bottom: 0.375rem;
  }

  :global(.markdown-preview p) {
    margin-top: 0;
    margin-bottom: 0.75rem;
  }

  :global(.markdown-preview ul, .markdown-preview ol) {
    margin-top: 0;
    margin-bottom: 0.75rem;
    padding-left: 1.5rem;
  }

  :global(.markdown-preview li) {
    margin-bottom: 0.25rem;
  }

  :global(.markdown-preview code) {
    background: #f1f5f9;
    padding: 0.125rem 0.375rem;
    border-radius: 4px;
    font-family: ui-monospace, "JetBrains Mono", "IBM Plex Mono", Menlo, Consolas, monospace;
    font-size: 0.8125rem;
    color: #0f172a;
    word-break: break-word;
  }

  :global(.markdown-preview pre) {
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

  :global(.markdown-preview pre code) {
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

  :global(.markdown-preview pre::-webkit-scrollbar) {
    height: 6px;
  }

  :global(.markdown-preview pre::-webkit-scrollbar-track) {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 3px;
  }

  :global(.markdown-preview pre::-webkit-scrollbar-thumb) {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 3px;
  }

  :global(.markdown-preview pre::-webkit-scrollbar-thumb:hover) {
    background: rgba(255, 255, 255, 0.35);
  }

  :global(.markdown-preview blockquote) {
    margin: 0.75rem 0;
    padding-left: 1rem;
    border-left: 4px solid #cbd5e1;
    color: #475569;
    font-style: italic;
  }

  :global(.markdown-preview table) {
    width: 100%;
    border-collapse: collapse;
    margin: 0.75rem 0;
  }

  :global(.markdown-preview th, .markdown-preview td) {
    border: 1px solid #e2e8f0;
    padding: 0.5rem 0.75rem;
    text-align: left;
  }

  :global(.markdown-preview th) {
    background: #f8fafc;
    font-weight: 600;
  }

  .editor-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding-top: 0.5rem;
  }

  .footer-left {
    display: flex;
    align-items: center;
  }

  .footer-right {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-left: auto;
  }

  .btn-primary {
    background: #2563eb;
    color: #ffffff;
    border: none;
    padding: 0.5rem 1.125rem;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s ease, box-shadow 0.15s ease;
  }

  .btn-primary:hover:not(:disabled) {
    background: #1d4ed8;
  }

  .btn-primary.is-dirty {
    background: #2563eb;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.25), 0 1px 2px 0 rgba(0, 0, 0, 0.05);
    font-weight: 700;
  }

  .btn-primary.is-dirty:hover:not(:disabled) {
    background: #1d4ed8;
    box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.35), 0 2px 4px 0 rgba(0, 0, 0, 0.1);
  }

  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-secondary {
    background: #f8fafc;
    color: #475569;
    border: 1px solid #cbd5e1;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-secondary:hover:not(:disabled) {
    background: #f1f5f9;
    color: #0f172a;
  }

  .btn-danger {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    background: transparent;
    color: #dc2626;
    border: 1px solid #fecaca;
    padding: 0.5rem 0.875rem;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-danger:hover:not(:disabled) {
    background: #fee2e2;
  }

  @media (max-width: 768px) {
    .editor-workspace.split {
      grid-template-columns: 1fr;
    }

    .editor-workspace.split .editor-pane {
      border-right: none;
      border-bottom: 1px solid #e2e8f0;
      min-height: 240px;
    }
  }
</style>
