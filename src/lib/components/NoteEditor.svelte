<script module lang="ts">
  function getPropValue<T>(getter: () => T): T {
    return getter();
  }

  function onOutsideClick(node: HTMLElement, callback: () => void) {
    const handler = (event: MouseEvent) => {
      if (!node.contains(event.target as Node)) callback();
    };
    document.addEventListener('mousedown', handler);
    return {
      destroy() {
        document.removeEventListener('mousedown', handler);
      },
    };
  }
</script>

<script lang="ts">
  import { renderMarkdown } from '$lib/utils/markdown';
  import { mermaidRenderer } from '$lib/actions/mermaid';
  import ShareDialog from './ShareDialog.svelte';
  import PresentationModal from './PresentationModal.svelte';
  import { toast } from '$lib/stores/toast.svelte';
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
    IconSpinner,
    IconChevronUp,
    IconDownload,
    IconPresentation,
    IconMore,
    IconCheck,
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
    onTogglePin?: (noteId: string, isPinned: boolean) => void;
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
    onTogglePin,
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
  let isPresentationOpen = $state(false);
  let isMoreMenuOpen = $state(false);
  let tagList = $state<string[]>(getPropValue(() => (note?.tags ? note.tags.map((t) => t.name) : [])));
  let tagInput = $state('');
  let titleTouched = $state(false);
  let previewPaneRef = $state<HTMLDivElement | null>(null);
  let showScrollTopBtn = $state(false);

  function handlePreviewScroll(e: Event) {
    const target = e.target as HTMLElement;
    showScrollTopBtn = target.scrollTop > 220;
  }

  function scrollToTop() {
    previewPaneRef?.scrollTo({ top: 0, behavior: 'smooth' });
  }

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

  let currentLoadedNoteId = $state<string | null | undefined>(undefined);
  let currentLoadedIsNew = $state<boolean | undefined>(undefined);

  // Sync props only when selected note identity changes
  $effect(() => {
    const noteId = note?.id ?? null;
    const currentIsNew = isNew;

    if (noteId !== currentLoadedNoteId || currentIsNew !== currentLoadedIsNew) {
      currentLoadedNoteId = noteId;
      currentLoadedIsNew = currentIsNew;

      initialTitle = note?.title ?? '';
      initialContent = note?.content ?? '';
      initialIsPinned = note?.isPinned ?? false;
      initialTagList = note?.tags ? note.tags.map((t) => t.name) : [];

      title = initialTitle;
      content = initialContent;
      debouncedContent = initialContent;
      isPinned = initialIsPinned;
      isPublic = note?.isPublic ?? false;
      shareToken = note?.shareToken ?? null;
      tagList = [...initialTagList];
      tagInput = '';
      titleTouched = false;
      isMoreMenuOpen = false;
    }
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

  // Sync dirty state to bindable prop and notify callback only on actual value change
  $effect(() => {
    const currentDirty = isDirtyDerived;
    if (isDirty !== currentDirty) {
      isDirty = currentDirty;
      onDirtyChange?.(currentDirty);
    }
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

  function handlePinToggle(e?: Event) {
    const nextPinned = e ? (e.target as HTMLInputElement).checked : !isPinned;
    isPinned = nextPinned;

    if (note?.id && !isNew) {
      initialIsPinned = nextPinned;
      onTogglePin?.(note.id, nextPinned);
    }
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

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    titleTouched = true;
    if (!isTitleValid) {
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
    } else {
      isSubmitting = true;
      try {
        const result = await submitSave();
        if (result.success) {
          isDirty = false;
        }
      } finally {
        isSubmitting = false;
      }
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
    isMoreMenuOpen = false;
    onToggleFocusMode?.();
  }

  function handleDelete() {
    isMoreMenuOpen = false;
    if (note?.id && onDelete) {
      onDelete(note.id);
    }
  }

  type ExportFormat = 'docx' | 'doc' | 'html';

  const exportFormats: Array<{ format: ExportFormat; label: string; hint: string }> = [
    { format: 'docx', label: 'Word Document', hint: '.docx' },
    { format: 'doc', label: 'Word 97-2003', hint: '.doc' },
    { format: 'html', label: 'Google Docs', hint: '.html' },
  ];

  let isExporting = $state<ExportFormat | null>(null);

  function closeMoreMenu() {
    isMoreMenuOpen = false;
  }

  $effect(() => {
    if (!isMoreMenuOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMoreMenu();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  $effect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        isPresentationOpen = !isPresentationOpen;
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  });

  function extractDownloadFilename(disposition: string, fallback: string): string {
    const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match) {
      try {
        return decodeURIComponent(utf8Match[1]);
      } catch {
        // fall through to ASCII filename
      }
    }
    const asciiMatch = disposition.match(/filename="([^"]+)"/i);
    return asciiMatch ? asciiMatch[1] : fallback;
  }

  async function handleExport(format: ExportFormat) {
    if (!note?.id || isNew || isExporting) return;
    closeMoreMenu();
    isExporting = format;

    try {
      const response = await fetch(`/api/notes/${note.id}/export?format=${format}`);
      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(result?.error || `Export failed (${response.status})`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = extractDownloadFilename(
        response.headers.get('Content-Disposition') ?? '',
        `note.${format}`
      );
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);

      toast.success(`Exported "${title.trim() || 'Note'}" as .${format}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export failed');
    } finally {
      isExporting = null;
    }
  }

  let isUploadingToDrive = $state(false);

  async function handleExportToDrive() {
    if (!note?.id || isNew || isUploadingToDrive) return;
    closeMoreMenu();
    isUploadingToDrive = true;
    try {
      const response = await fetch(`/api/notes/${note.id}/export/drive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: 'docx' }),
      });
      const result = (await response.json().catch(() => null)) as { fileId?: string; link?: string | null; error?: string; code?: string } | null;
      if (!response.ok) {
        if (result?.code === 'google_not_connected') {
          toast.info('Connect your Google account to save to Drive');
          window.location.href = '/google';
          return;
        }
        throw new Error(result?.error || `Upload failed (${response.status})`);
      }
      const link = result?.link ?? null;
      if (link) {
        toast.showWithAction(`Uploaded "${title.trim() || 'Note'}" to Google Drive`, { label: 'Open', onClick: () => { window.open(link, '_blank', 'noopener'); } }, 'success', 6000);
      } else {
        toast.success(`Uploaded "${title.trim() || 'Note'}" to Google Drive`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Google Drive upload failed');
    } finally {
      isUploadingToDrive = false;
    }
  }
</script>

<div class="note-editor-wrapper {isFocusMode ? 'focus-mode' : ''}">
  {#if formError}
    <div class="alert-error" role="alert">
      <IconAlert size={15} />
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

    <!-- Calm Centered Container for Title & Metadata -->
    <div class="canvas-header-container {viewMode === 'split' ? 'full-width' : ''}">
      <!-- Note Title -->
      <div class="title-input-row">
        <input
          type="text"
          name="title"
          class="title-input {titleTouched && !isTitleValid ? 'invalid' : ''}"
          placeholder="Untitled Note..."
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

      <!-- Metadata & Tags Row -->
      <div class="metadata-row">
        <div class="tags-manager-row">
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
              placeholder="+ tag..."
              bind:value={tagInput}
              onkeydown={handleTagKeyDown}
              onblur={handleTagBlur}
            />
          </div>
        </div>

        {#if isPublic}
          <button
            type="button"
            class="public-badge-pill"
            onclick={() => (isShareDialogOpen = true)}
            title="Publicly shared note (click to manage)"
          >
            <span class="public-dot"></span>
            <span>Public link active</span>
          </button>
        {/if}
      </div>

      <!-- Minimal Toolbar -->
      <div class="minimal-toolbar">
        <div class="toolbar-left">
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

          <!-- Autosave / Saved Status Indicator -->
          <div class="status-indicator-wrap">
            {#if isDirtyDerived}
              <span class="unsaved-badge" role="status" aria-label="Unsaved changes">
                <span class="unsaved-dot" aria-hidden="true">●</span>
                <span>Unsaved changes</span>
              </span>
            {:else if note?.id && !isNew}
              <span class="saved-badge" role="status" aria-label="All changes saved">
                <IconCheck size={12} />
                <span>Saved</span>
              </span>
            {/if}
          </div>
        </div>

        <div class="toolbar-right">
          <!-- Pin Note Button -->
          <label
            class="pin-toggle-btn {isPinned ? 'pinned' : ''}"
            title={isPinned ? 'Unpin note' : 'Pin note'}
          >
            <input
              type="checkbox"
              checked={isPinned}
              onchange={handlePinToggle}
              class="sr-only"
              aria-label={isPinned ? 'Unpin note' : 'Pin note'}
            />
            <IconPin size={13} filled={isPinned} />
            <span>{isPinned ? 'Pinned' : 'Pin'}</span>
          </label>

          <!-- Share Note Button (Available for saved notes) -->
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

          <!-- More Secondary Actions Dropdown Menu -->
          <div class="more-menu-wrapper" use:onOutsideClick={closeMoreMenu}>
            <button
              type="button"
              class="btn-tool more-toggle-btn {isMoreMenuOpen ? 'active' : ''}"
              onclick={() => (isMoreMenuOpen = !isMoreMenuOpen)}
              aria-haspopup="menu"
              aria-expanded={isMoreMenuOpen}
              title="More actions"
              aria-label="More actions"
              data-testid="export-note-btn"
            >
              {#if isExporting || isUploadingToDrive}
                <IconSpinner size={14} />
              {:else}
                <IconMore size={16} />
              {/if}
            </button>

            <!-- Dropdown Menu (Rendered in DOM for keyboard accessibility & tests) -->
            <div
              class="more-menu-dropdown {isMoreMenuOpen ? 'open' : ''}"
              role="menu"
              aria-label="More actions menu"
              data-testid="export-menu"
            >
              <!-- Present Slideshow -->
              <button
                type="button"
                class="dropdown-item pres-toggle-btn"
                role="menuitem"
                onclick={() => {
                  isMoreMenuOpen = false;
                  isPresentationOpen = true;
                }}
                title="Start Presentation (Slides mode) [Alt+P]"
                aria-label="Start Presentation (Slides mode)"
                data-testid="toggle-presentation-mode"
              >
                <span class="dropdown-item-left">
                  <IconPresentation size={14} />
                  <span>Present Slides</span>
                </span>
                <span class="dropdown-item-hint">Alt+P</span>
              </button>

              <!-- Focus Mode Toggle -->
              <button
                type="button"
                class="dropdown-item focus-toggle-btn {isFocusMode ? 'active' : ''}"
                onclick={handleToggleFocus}
                title={isFocusMode ? 'Exit focus mode (Esc)' : 'Enter focus mode'}
                aria-label={isFocusMode ? 'Exit focus mode' : 'Enter focus mode'}
                aria-pressed={isFocusMode}
                data-testid="toggle-focus-mode"
              >
                <span class="dropdown-item-left">
                  <IconMaximize size={14} />
                  <span>{isFocusMode ? 'Exit Focus' : 'Focus'}</span>
                </span>
                <span class="dropdown-item-hint">Esc</span>
              </button>

              {#if note?.id && !isNew}
                <div class="dropdown-divider" role="separator"></div>

                <div class="dropdown-section-label">EXPORT DOCUMENT</div>

                {#each exportFormats as item (item.format)}
                  <button
                    type="button"
                    class="dropdown-item export-menu-item"
                    role="menuitem"
                    onclick={() => handleExport(item.format)}
                    disabled={isExporting !== null || isUploadingToDrive}
                    data-testid={`export-option-${item.format}`}
                  >
                    <span class="dropdown-item-left">
                      <IconDownload size={14} />
                      <span>{item.label}</span>
                    </span>
                    <span class="dropdown-item-hint">{item.hint}</span>
                  </button>
                {/each}

                <button
                  type="button"
                  class="dropdown-item export-menu-item"
                  role="menuitem"
                  onclick={handleExportToDrive}
                  disabled={isUploadingToDrive || isExporting !== null}
                  data-testid="export-option-drive"
                >
                  <span class="dropdown-item-left">
                    <IconDownload size={14} />
                    <span>Save to Google Drive</span>
                  </span>
                  <span class="dropdown-item-hint">.docx</span>
                </button>
              {/if}

              {#if note?.id && onDelete}
                <div class="dropdown-divider" role="separator"></div>
                <button
                  type="button"
                  class="dropdown-item danger-item btn-danger"
                  role="menuitem"
                  onclick={handleDelete}
                  disabled={isSubmitting}
                >
                  <span class="dropdown-item-left">
                    <IconTrash size={14} />
                    <span>Delete Note</span>
                  </span>
                </button>
              {/if}
            </div>
          </div>

          <!-- Save Button -->
          <button
            type="submit"
            class="btn-primary {isDirtyDerived ? 'is-dirty' : ''}"
            disabled={isSubmitting || (titleTouched && !isTitleValid)}
            title={note?.id && !isNew ? 'Save changes (Cmd/Ctrl+S)' : 'Save note (Cmd/Ctrl+S)'}
            aria-label={note?.id && !isNew ? 'Save changes' : 'Save note'}
          >
            {#if isSubmitting}
              <IconSpinner size={13} />
              <span>Saving...</span>
            {:else}
              <span>{note?.id && !isNew ? 'Save Changes' : 'Create Note'}</span>
            {/if}
          </button>
        </div>
      </div>
    </div>

    <!-- Workspace Body: Edit, Preview, or Split -->
    <div class="workspace-body-container {viewMode === 'split' ? 'full-width' : ''}">
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
          <div
            bind:this={previewPaneRef}
            class="workspace-pane preview-pane"
            role="region"
            aria-label="Markdown Preview"
            onscroll={handlePreviewScroll}
          >
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

            {#if showScrollTopBtn}
              <button
                type="button"
                class="btn-scroll-top"
                onclick={scrollToTop}
                title="Scroll to top"
                aria-label="Scroll to top"
              >
                <IconChevronUp size={15} />
              </button>
            {/if}
          </div>
        {/if}
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

  <PresentationModal
    isOpen={isPresentationOpen}
    noteTitle={title || 'Presentation'}
    markdownContent={content}
    onClose={() => (isPresentationOpen = false)}
  />
</div>

<style>
  .note-editor-wrapper {
    background: #ffffff;
    display: flex;
    flex-direction: column;
    height: 100%;
    box-sizing: border-box;
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .editor-form {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }

  .alert-error {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: #fef2f2;
    border: 1px solid #fecaca;
    color: #b91c1c;
    padding: 0.5rem 0.875rem;
    border-radius: 6px;
    font-size: 0.8125rem;
    font-weight: 500;
    margin: 0.75rem 1.25rem 0 1.25rem;
  }

  /* Centered calm canvas column for readable reading & writing */
  .canvas-header-container {
    max-width: 760px;
    width: 100%;
    margin: 0 auto;
    padding: 1.25rem 1.25rem 0.5rem 1.25rem;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
  }

  .canvas-header-container.full-width {
    max-width: 100%;
    padding: 1rem 1.25rem 0.5rem 1.25rem;
  }

  .title-input-row {
    position: relative;
    display: flex;
    align-items: center;
    width: 100%;
  }

  .title-input {
    width: 100%;
    padding: 0.25rem 0;
    font-size: 1.75rem;
    font-weight: 700;
    color: #0f172a;
    border: none;
    border-bottom: 1px solid transparent;
    outline: none;
    background: transparent;
    letter-spacing: -0.02em;
    line-height: 1.25;
    transition: border-color 0.15s ease;
  }

  .title-input:focus {
    border-bottom-color: #cbd5e1;
  }

  .title-input.invalid {
    border-bottom-color: #ef4444;
  }

  .title-input::placeholder {
    color: #cbd5e1;
  }

  .char-count {
    position: absolute;
    right: 0;
    font-size: 0.6875rem;
    color: #94a3b8;
    pointer-events: none;
  }

  .char-count.overflow {
    color: #ef4444;
    font-weight: 600;
  }

  .metadata-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    min-height: 28px;
    flex-wrap: wrap;
  }

  .tags-manager-row {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    flex: 1;
    min-width: 180px;
  }

  .tag-chips-container {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.25rem;
  }

  .tag-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.1875rem;
    background: #f1f5f9;
    color: #475569;
    font-size: 0.6875rem;
    font-weight: 500;
    padding: 0.125rem 0.375rem;
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
    font-size: 0.75rem;
    color: #0f172a;
    padding: 0.125rem 0.25rem;
    min-width: 60px;
    background: transparent;
  }

  .tag-inline-input::placeholder {
    color: #94a3b8;
  }

  .public-badge-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.3125rem;
    font-size: 0.6875rem;
    font-weight: 600;
    color: #059669;
    background: #ecfdf5;
    border: 1px solid #a7f3d0;
    padding: 0.1875rem 0.5rem;
    border-radius: 9999px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .public-badge-pill:hover {
    background: #d1fae5;
  }

  .public-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #10b981;
  }

  /* Minimal Clean Toolbar */
  .minimal-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.5rem 0;
    border-bottom: 1px solid #f1f5f9;
  }

  .toolbar-left,
  .toolbar-right {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .status-indicator-wrap {
    display: inline-flex;
    align-items: center;
    min-height: 24px;
  }

  .unsaved-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.3125rem;
    padding: 0.1875rem 0.5rem;
    font-size: 0.6875rem;
    font-weight: 600;
    color: #b45309;
    background: #fef3c7;
    border: 1px solid #fde68a;
    border-radius: 9999px;
    white-space: nowrap;
  }

  .unsaved-dot {
    font-size: 0.5625rem;
    color: #f59e0b;
  }

  .saved-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.6875rem;
    font-weight: 500;
    color: #64748b;
  }

  .view-mode-tabs {
    display: inline-flex;
    background: #f1f5f9;
    padding: 2px;
    border-radius: 6px;
    border: 1px solid #e2e8f0;
    gap: 2px;
    align-items: center;
  }

  .mode-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    background: transparent;
    border: 1px solid transparent;
    padding: 0.1875rem 0.5rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: #64748b;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .mode-btn:hover {
    color: #0f172a;
    background: rgba(255, 255, 255, 0.6);
  }

  .mode-btn.active {
    background: #ffffff;
    color: #0f172a;
    font-weight: 600;
    border-color: #e2e8f0;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  }

  .mode-btn:focus-visible {
    outline: 2px solid #2563eb;
    outline-offset: 1px;
  }

  .pin-toggle-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
    font-weight: 500;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    background: transparent;
    color: #64748b;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .pin-toggle-btn:hover {
    background: #f1f5f9;
    color: #0f172a;
  }

  .pin-toggle-btn.pinned {
    background: #fef3c7;
    border-color: #fde68a;
    color: #92400e;
    font-weight: 600;
  }

  .share-toggle-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
    font-weight: 500;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    background: transparent;
    color: #64748b;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .share-toggle-btn:hover {
    background: #f1f5f9;
    color: #0f172a;
  }

  .share-toggle-btn.is-shared {
    background: #ecfdf5;
    border-color: #a7f3d0;
    color: #059669;
    font-weight: 600;
  }

  .more-menu-wrapper {
    position: relative;
    display: inline-flex;
  }

  .btn-tool {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    border: 1px solid #e2e8f0;
    background: transparent;
    color: #64748b;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-tool:hover {
    background: #f1f5f9;
    color: #0f172a;
  }

  .btn-tool.active {
    background: #e2e8f0;
    color: #0f172a;
  }

  .more-menu-dropdown {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    z-index: 50;
    min-width: 210px;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.05);
    padding: 0.3125rem;
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .more-menu-dropdown:not(.open) {
    display: none;
  }

  .dropdown-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.375rem 0.625rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: #334155;
    background: transparent;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    text-align: left;
    transition: background 0.12s ease;
    width: 100%;
    box-sizing: border-box;
  }

  .dropdown-item:hover {
    background: #f1f5f9;
    color: #0f172a;
  }

  .dropdown-item.danger-item {
    color: #dc2626;
  }

  .dropdown-item.danger-item:hover {
    background: #fee2e2;
  }

  .dropdown-item-left {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }

  .dropdown-item-hint {
    font-size: 0.6875rem;
    color: #94a3b8;
  }

  .dropdown-divider {
    height: 1px;
    background: #f1f5f9;
    margin: 0.25rem 0.375rem;
  }

  .dropdown-section-label {
    font-size: 0.625rem;
    font-weight: 700;
    color: #94a3b8;
    letter-spacing: 0.06em;
    padding: 0.25rem 0.625rem 0.125rem 0.625rem;
  }

  .btn-primary {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    background: #2563eb;
    color: #ffffff;
    border: none;
    padding: 0.25rem 0.75rem;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .btn-primary:hover:not(:disabled) {
    background: #1d4ed8;
  }

  .btn-primary.is-dirty {
    background: #2563eb;
    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.25);
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
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

  /* Workspace Prose Container */
  .workspace-body-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    width: 100%;
    max-width: 760px;
    margin: 0 auto;
    padding: 0 1.25rem 1.25rem 1.25rem;
    box-sizing: border-box;
  }

  .workspace-body-container.full-width {
    max-width: 100%;
    padding: 0 1.25rem 1.25rem 1.25rem;
  }

  .editor-workspace {
    flex: 1;
    display: flex;
    min-height: 480px;
    width: 100%;
    box-sizing: border-box;
  }

  .editor-workspace.split {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem;
  }

  .editor-workspace.edit,
  .editor-workspace.preview {
    display: flex;
    flex-direction: column;
  }

  .workspace-pane {
    height: 100%;
    overflow-y: auto;
    overscroll-behavior: contain;
    scroll-behavior: smooth;
    -webkit-overflow-scrolling: touch;
    box-sizing: border-box;
    min-width: 0;
    flex: 1;
    width: 100%;
  }

  .editor-pane {
    display: flex;
    flex-direction: column;
    width: 100%;
  }

  .editor-workspace.split .editor-pane {
    border-right: 1px solid #f1f5f9;
    padding-right: 0.75rem;
  }

  .markdown-textarea {
    width: 100%;
    height: 100%;
    min-height: 480px;
    flex: 1;
    padding: 1rem 0;
    border: none;
    outline: none;
    resize: none;
    font-family: ui-monospace, "JetBrains Mono", "IBM Plex Mono", Menlo, Consolas, monospace;
    font-size: 0.9375rem;
    line-height: 1.7;
    tab-size: 2;
    -moz-tab-size: 2;
    white-space: pre-wrap;
    overflow-wrap: break-word;
    color: #1e293b;
    background: transparent;
    box-sizing: border-box;
  }

  .preview-pane {
    position: relative;
    padding: 1rem 0;
    background: transparent;
    flex: 1;
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
  }

  .editor-workspace.split .preview-pane {
    padding-left: 0.75rem;
  }

  .btn-scroll-top {
    position: sticky;
    bottom: 1rem;
    float: right;
    margin-top: -3rem;
    margin-right: 0.25rem;
    z-index: 20;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    color: #64748b;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-scroll-top:hover {
    background: #2563eb;
    border-color: #2563eb;
    color: #ffffff;
  }

  .empty-preview {
    color: #94a3b8;
    font-size: 0.875rem;
    padding: 3rem 1rem;
    text-align: center;
  }

  .markdown-preview {
    font-size: 0.9375rem;
    line-height: 1.75;
    color: #1e293b;
    word-break: break-word;
    overflow-wrap: break-word;
  }

  :global(.markdown-preview h1) {
    font-size: 1.625rem; /* 26px */
    font-weight: 700;
    margin-top: 1.25rem;
    margin-bottom: 0.75rem;
    border-bottom: 1px solid #f1f5f9;
    padding-bottom: 0.375rem;
    letter-spacing: -0.02em;
    color: #0f172a;
  }

  :global(.markdown-preview h1:first-child) {
    margin-top: 0;
  }

  :global(.markdown-preview h2) {
    font-size: 1.25rem; /* 20px */
    font-weight: 600;
    margin-top: 1.5rem;
    margin-bottom: 0.5rem;
    letter-spacing: -0.01em;
    color: #0f172a;
  }

  :global(.markdown-preview h3) {
    font-size: 1.0625rem; /* 17px */
    font-weight: 600;
    margin-top: 1.25rem;
    margin-bottom: 0.375rem;
    color: #0f172a;
  }

  :global(.markdown-preview p) {
    margin-top: 0;
    margin-bottom: 0.875rem;
    color: #334155;
  }

  :global(.markdown-preview ul, .markdown-preview ol) {
    margin-top: 0;
    margin-bottom: 0.875rem;
    padding-left: 1.5rem;
    color: #334155;
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
    overflow-wrap: break-word;
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
    margin: 1rem 0;
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

  :global(.markdown-preview blockquote) {
    margin: 1rem 0;
    padding-left: 1rem;
    border-left: 3px solid #cbd5e1;
    color: #475569;
    font-style: italic;
  }

  :global(.markdown-preview .table-container) {
    width: 100%;
    overflow-x: auto;
    margin: 1rem 0;
    border-radius: 6px;
    border: 1px solid #e2e8f0;
  }

  :global(.markdown-preview table) {
    width: 100%;
    min-width: 600px;
    border-collapse: collapse;
    margin: 0;
    font-size: 0.875rem;
    line-height: 1.5;
  }

  :global(.markdown-preview th) {
    background: #f8fafc;
    color: #0f172a;
    font-weight: 600;
    border-bottom: 1px solid #e2e8f0;
    border-right: 1px solid #f1f5f9;
    padding: 0.5rem 0.75rem;
    text-align: left;
    white-space: nowrap;
    word-break: normal;
  }

  :global(.markdown-preview td) {
    border-bottom: 1px solid #f1f5f9;
    border-right: 1px solid #f1f5f9;
    padding: 0.5rem 0.75rem;
    color: #334155;
    vertical-align: top;
    word-break: normal;
    overflow-wrap: break-word;
  }

  :global(.markdown-preview th:last-child),
  :global(.markdown-preview td:last-child) {
    border-right: none;
  }

  :global(.markdown-preview tr:last-child td) {
    border-bottom: none;
  }

  :global(.markdown-preview tr:nth-child(even)) {
    background: #fcfcfd;
  }

  :global(.markdown-preview table code) {
    white-space: nowrap;
    word-break: normal;
  }

  :global(.markdown-preview td[style*="text-align: center"]) {
    white-space: nowrap;
  }

  @media (max-width: 768px) {
    .editor-workspace.split {
      grid-template-columns: 1fr;
    }

    .editor-workspace.split .editor-pane {
      border-right: none;
      border-bottom: 1px solid #f1f5f9;
      min-height: 240px;
    }
  }
</style>
