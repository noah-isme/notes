<script module lang="ts">
  function getPropValue<T>(getter: () => T): T {
    return getter();
  }
</script>

<script lang="ts">
  import { renderMarkdown } from '$lib/utils/markdown';
  import { mermaidRenderer } from '$lib/actions/mermaid';
  import {
    IconPin,
    IconEdit,
    IconEye,
    IconSplit,
    IconTrash,
    IconAlert,
    IconClose,
  } from './icons';

  export interface NoteEditorData {
    id?: string;
    title: string;
    content: string;
    isPinned: boolean;
    tags: Array<{ id?: string; name: string }>;
  }

  interface NoteEditorProps {
    note?: NoteEditorData | null;
    isNew?: boolean;
    formError?: string | null;
    isSubmitting?: boolean;
    onSave?: (data: {
      id?: string;
      title: string;
      content: string;
      isPinned: boolean;
      tags: string[];
    }) => void;
    onCancel?: () => void;
    onDelete?: (noteId: string) => void;
  }

  let {
    note = null,
    isNew = false,
    formError = null,
    isSubmitting = false,
    onSave,
    onCancel,
    onDelete,
  }: NoteEditorProps = $props();

  let title = $state(getPropValue(() => note?.title ?? ''));
  let content = $state(getPropValue(() => note?.content ?? ''));
  let debouncedContent = $state(getPropValue(() => note?.content ?? ''));
  let isPinned = $state(getPropValue(() => note?.isPinned ?? false));
  let tagList = $state<string[]>(getPropValue(() => (note?.tags ? note.tags.map((t) => t.name) : [])));
  let tagInput = $state('');
  let viewMode = $state<'edit' | 'preview' | 'split'>('split');
  let titleTouched = $state(false);

  // Sync props when selected note changes
  $effect(() => {
    title = note?.title ?? '';
    content = note?.content ?? '';
    debouncedContent = note?.content ?? '';
    isPinned = note?.isPinned ?? false;
    tagList = note?.tags ? note.tags.map((t) => t.name) : [];
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

  function handleDelete() {
    if (note?.id && onDelete) {
      if (typeof window !== 'undefined' && window.confirm('Are you sure you want to delete this note?')) {
        onDelete(note.id);
      }
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

        <!-- View Mode Switcher -->
        <div class="view-mode-tabs" role="tablist" aria-label="Editor View Modes">
          <button
            type="button"
            class="mode-btn {viewMode === 'edit' ? 'active' : ''}"
            onclick={() => (viewMode = 'edit')}
            role="tab"
            aria-selected={viewMode === 'edit'}
            title="Edit mode"
          >
            <IconEdit size={13} />
            <span>Edit</span>
          </button>
          <button
            type="button"
            class="mode-btn {viewMode === 'split' ? 'active' : ''}"
            onclick={() => (viewMode = 'split')}
            role="tab"
            aria-selected={viewMode === 'split'}
            title="Split mode"
          >
            <IconSplit size={13} />
            <span>Split</span>
          </button>
          <button
            type="button"
            class="mode-btn {viewMode === 'preview' ? 'active' : ''}"
            onclick={() => (viewMode = 'preview')}
            role="tab"
            aria-selected={viewMode === 'preview'}
            title="Preview mode"
          >
            <IconEye size={13} />
            <span>Preview</span>
          </button>
        </div>
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
          class="btn-primary"
          disabled={isSubmitting || (titleTouched && !isTitleValid)}
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
    border: 1px solid #e2e8f0;
  }

  .mode-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.3125rem;
    background: none;
    border: none;
    padding: 0.25rem 0.625rem;
    font-size: 0.8125rem;
    font-weight: 500;
    color: #64748b;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .mode-btn:hover {
    color: #1e293b;
  }

  .mode-btn.active {
    background: #ffffff;
    color: #0f172a;
    font-weight: 600;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
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
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono',
      'Courier New', monospace;
    font-size: 0.875rem;
    line-height: 1.6;
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
    font-family: ui-monospace, monospace;
    font-size: 0.8125rem;
    color: #0f172a;
  }

  :global(.markdown-preview pre) {
    background: #0f172a;
    color: #f8fafc;
    padding: 0.875rem 1rem;
    border-radius: 6px;
    overflow-x: auto;
    margin: 0.75rem 0;
  }

  :global(.markdown-preview pre code) {
    background: transparent;
    color: inherit;
    padding: 0;
    font-size: 0.8125rem;
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
    transition: background 0.15s ease;
  }

  .btn-primary:hover:not(:disabled) {
    background: #1d4ed8;
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
