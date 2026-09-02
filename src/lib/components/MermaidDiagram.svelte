<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { browser } from '$app/environment';
  import { renderMermaidSvg, generateDiagramId } from '$lib/utils/mermaid';
  import {
    IconCopy,
    IconMaximize,
    IconZoomIn,
    IconZoomOut,
    IconRotateCcw,
    IconCode,
    IconDownload,
    IconCheck,
    IconAlertCircle,
    IconClose,
  } from './icons';

  interface Props {
    code: string;
    id?: string;
    title?: string;
    showControls?: boolean;
  }

  let {
    code = '',
    id = '',
    title = '',
    showControls = true,
  }: Props = $props();

  let isMounted = $state(browser);
  let renderedSvg = $state('');
  let renderError = $state<string | null>(null);
  let isLoading = $state(true);
  let showRawCode = $state(false);
  let isModalOpen = $state(false);
  let copiedSource = $state(false);
  let copiedSvg = $state(false);

  // Modal zoom & pan state
  let zoomLevel = $state(1.0);
  let panOffset = $state({ x: 0, y: 0 });
  let isDragging = $state(false);
  let startPos = { x: 0, y: 0 };
  let startPan = { x: 0, y: 0 };

  const autoId = generateDiagramId('diag');
  let instanceId = $derived(id || autoId);
  let svgContainerElement = $state<HTMLDivElement | null>(null);

  onMount(() => {
    isMounted = true;
  });

  // Re-render when code or instanceId changes in client mode
  $effect(() => {
    if (!browser || !isMounted) return;

    let isCurrent = true;
    isLoading = true;

    async function doRender() {
      if (!code || !code.trim()) {
        renderedSvg = '';
        renderError = 'Empty diagram definition';
        isLoading = false;
        return;
      }

      try {
        const result = await renderMermaidSvg(instanceId, code);
        if (!isCurrent) return;

        if ('error' in result) {
          renderError = result.error;
          renderedSvg = '';
        } else {
          renderError = null;
          renderedSvg = result.svg;
          await tick();
          if (svgContainerElement && result.bindFunctions) {
            result.bindFunctions(svgContainerElement);
          }
        }
      } catch (err: any) {
        if (!isCurrent) return;
        renderError = err?.message || String(err);
        renderedSvg = '';
      } finally {
        if (isCurrent) {
          isLoading = false;
        }
      }
    }

    doRender();

    return () => {
      isCurrent = false;
    };
  });

  // Body scroll lock effect when fullscreen modal is open
  $effect(() => {
    if (browser && isModalOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  });

  async function copySource() {
    if (!browser || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(code);
      copiedSource = true;
      setTimeout(() => {
        copiedSource = false;
      }, 2000);
    } catch (err) {
      console.error('Failed to copy diagram source:', err);
    }
  }

  async function copySvg() {
    if (!browser || !navigator.clipboard || !renderedSvg) return;
    try {
      await navigator.clipboard.writeText(renderedSvg);
      copiedSvg = true;
      setTimeout(() => {
        copiedSvg = false;
      }, 2000);
    } catch (err) {
      console.error('Failed to copy rendered SVG:', err);
    }
  }

  function downloadSvg() {
    if (!browser || !renderedSvg) return;
    try {
      const blob = new Blob([renderedSvg], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const sanitizedTitle = title ? title.toLowerCase().replace(/[^a-z0-9]+/g, '-') : 'mermaid-diagram';
      link.download = `${sanitizedTitle}.svg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download SVG:', err);
    }
  }

  function toggleRawCode() {
    showRawCode = !showRawCode;
  }

  function openModal() {
    zoomLevel = 1.0;
    panOffset = { x: 0, y: 0 };
    isModalOpen = true;
  }

  function closeModal() {
    isModalOpen = false;
  }

  function handleModalKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      closeModal();
    }
  }

  function zoomIn() {
    zoomLevel = Math.min(4.0, +(zoomLevel + 0.25).toFixed(2));
  }

  function zoomOut() {
    zoomLevel = Math.max(0.25, +(zoomLevel - 0.25).toFixed(2));
  }

  function resetZoom() {
    zoomLevel = 1.0;
    panOffset = { x: 0, y: 0 };
  }

  function handleWheel(e: WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.15 : -0.15;
    zoomLevel = Math.min(4.0, Math.max(0.25, +(zoomLevel + delta).toFixed(2)));
  }

  function handlePointerDown(e: PointerEvent) {
    if (e.button !== 0) return;
    isDragging = true;
    startPos = { x: e.clientX, y: e.clientY };
    startPan = { x: panOffset.x, y: panOffset.y };
    (e.currentTarget as HTMLElement)?.setPointerCapture?.(e.pointerId);
  }

  function handlePointerMove(e: PointerEvent) {
    if (!isDragging) return;
    panOffset = {
      x: startPan.x + (e.clientX - startPos.x),
      y: startPan.y + (e.clientY - startPos.y),
    };
  }

  function handlePointerUp(e: PointerEvent) {
    if (isDragging) {
      isDragging = false;
      try {
        (e.currentTarget as HTMLElement)?.releasePointerCapture?.(e.pointerId);
      } catch {}
    }
  }
</script>

<svelte:window onkeydown={isModalOpen ? handleModalKeydown : undefined} />

{#if !isMounted}
  <!-- SSR Fallback -->
  <div class="mermaid-block" data-mermaid-code={code}>
    {#if title}
      <div class="diagram-title">{title}</div>
    {/if}
    <pre><code class="language-mermaid">{code}</code></pre>
  </div>
{:else}
  <!-- Interactive Diagram Component -->
  <div class="mermaid-diagram-container" data-diagram-id={instanceId}>
    {#if title}
      <div class="diagram-header">
        <span class="diagram-title">{title}</span>
      </div>
    {/if}

    {#if showControls}
      <div class="diagram-toolbar" role="toolbar" aria-label="Diagram controls">
        <button
          type="button"
          class="toolbar-btn {copiedSource ? 'active' : ''}"
          onclick={copySource}
          title="Copy Mermaid source code"
          aria-label="Copy Mermaid source"
        >
          {#if copiedSource}
            <IconCheck size={14} class="text-emerald-600" />
            <span class="btn-text">Copied!</span>
          {:else}
            <IconCopy size={14} />
            <span class="btn-text">Copy Code</span>
          {/if}
        </button>

        {#if renderedSvg && !renderError}
          <button
            type="button"
            class="toolbar-btn {copiedSvg ? 'active' : ''}"
            onclick={copySvg}
            title="Copy rendered SVG XML"
            aria-label="Copy rendered SVG"
          >
            {#if copiedSvg}
              <IconCheck size={14} class="text-emerald-600" />
              <span class="btn-text">Copied!</span>
            {:else}
              <IconCopy size={14} />
              <span class="btn-text">Copy SVG</span>
            {/if}
          </button>

          <button
            type="button"
            class="toolbar-btn"
            onclick={downloadSvg}
            title="Download diagram as SVG"
            aria-label="Download SVG"
          >
            <IconDownload size={14} />
            <span class="btn-text">Download</span>
          </button>
        {/if}

        <button
          type="button"
          class="toolbar-btn {showRawCode ? 'active' : ''}"
          onclick={toggleRawCode}
          title={showRawCode ? 'Hide raw code' : 'Show raw code'}
          aria-label="Toggle raw code"
          aria-pressed={showRawCode}
        >
          <IconCode size={14} />
          <span class="btn-text">{showRawCode ? 'Hide Code' : 'Code'}</span>
        </button>

        {#if renderedSvg && !renderError}
          <button
            type="button"
            class="toolbar-btn"
            onclick={openModal}
            title="Open fullscreen preview and zoom"
            aria-label="Open fullscreen preview"
          >
            <IconMaximize size={14} />
            <span class="btn-text">Fullscreen</span>
          </button>
        {/if}
      </div>
    {/if}

    <div class="diagram-content">
      {#if renderError}
        <!-- Resilient Error Boundary Alert -->
        <div class="error-boundary-banner" role="alert" aria-live="assertive">
          <div class="error-header">
            <span class="error-icon" aria-hidden="true">
              <IconAlertCircle size={18} />
            </span>
            <div class="error-details">
              <strong class="error-title">Diagram Syntax Error</strong>
              <p class="error-message">{renderError}</p>
            </div>
          </div>
          <div class="error-fallback-code">
            <div class="fallback-header">
              <span>Source Definition</span>
            </div>
            <pre><code>{code}</code></pre>
          </div>
        </div>
      {:else if isLoading && !renderedSvg}
        <!-- Loading State -->
        <div class="diagram-loading" role="status">
          <div class="loading-spinner"></div>
          <span>Rendering diagram...</span>
        </div>
      {:else if renderedSvg}
        <!-- Rendered SVG Diagram -->
        <div
          bind:this={svgContainerElement}
          class="svg-viewport {isLoading ? 'opacity-50' : ''}"
          role="img"
          aria-label={title || 'Mermaid Diagram'}
        >
          <!-- eslint-disable-next-line svelte/no-at-html-tags -->
          {@html renderedSvg}
        </div>
      {/if}

      {#if showRawCode && !renderError}
        <!-- Toggleable Fallback Raw Code View -->
        <div class="raw-code-drawer">
          <div class="raw-code-header">
            <span>Mermaid Source</span>
          </div>
          <pre><code>{code}</code></pre>
        </div>
      {/if}
    </div>
  </div>

  <!-- WAI-ARIA 1.2 Fullscreen Zoom/Pan Modal Dialog -->
  {#if isModalOpen}
    <div
      class="modal-backdrop"
      onclick={closeModal}
      role="presentation"
    >
      <!-- Modal Dialog Window -->
      <div
        class="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Diagram Preview'}
        tabindex="-1"
        onclick={(e) => e.stopPropagation()}
        onkeydown={(e) => e.stopPropagation()}
      >
        <div class="modal-header">
          <div class="modal-title-group">
            <h2 class="modal-title">{title || 'Diagram Preview'}</h2>
            <span class="zoom-badge">{Math.round(zoomLevel * 100)}%</span>
          </div>

          <div class="modal-controls">
            <button
              type="button"
              class="modal-btn"
              onclick={zoomOut}
              title="Zoom out"
              aria-label="Zoom out"
              disabled={zoomLevel <= 0.25}
            >
              <IconZoomOut size={16} />
            </button>

            <button
              type="button"
              class="modal-btn"
              onclick={resetZoom}
              title="Reset zoom and pan"
              aria-label="Reset zoom and pan"
            >
              <IconRotateCcw size={16} />
            </button>

            <button
              type="button"
              class="modal-btn"
              onclick={zoomIn}
              title="Zoom in"
              aria-label="Zoom in"
              disabled={zoomLevel >= 4.0}
            >
              <IconZoomIn size={16} />
            </button>

            <button
              type="button"
              class="modal-btn"
              onclick={copySvg}
              title="Copy SVG XML"
              aria-label="Copy rendered SVG"
            >
              {#if copiedSvg}
                <IconCheck size={16} class="text-emerald-600" />
              {:else}
                <IconCopy size={16} />
              {/if}
            </button>

            <button
              type="button"
              class="modal-btn"
              onclick={downloadSvg}
              title="Download SVG"
              aria-label="Download SVG"
            >
              <IconDownload size={16} />
            </button>

            <div class="modal-divider"></div>

            <button
              type="button"
              class="modal-close-btn"
              onclick={closeModal}
              title="Close modal (Escape)"
              aria-label="Close modal"
            >
              <IconClose size={18} />
            </button>
          </div>
        </div>

        <!-- Interactive Pan/Zoom Canvas -->
        <div
          class="modal-canvas {isDragging ? 'is-dragging' : ''}"
          onwheel={handleWheel}
          onpointerdown={handlePointerDown}
          onpointermove={handlePointerMove}
          onpointerup={handlePointerUp}
          onpointercancel={handlePointerUp}
          role="region"
          aria-label="Interactive diagram canvas (drag to pan, scroll to zoom)"
        >
          <div
            class="modal-svg-wrapper"
            style="transform: translate({panOffset.x}px, {panOffset.y}px) scale({zoomLevel}); transform-origin: center center;"
          >
            <!-- eslint-disable-next-line svelte/no-at-html-tags -->
            {@html renderedSvg}
          </div>
        </div>

        <div class="modal-footer-hint">
          <span>Tip: Scroll to zoom &bull; Drag to pan &bull; Press Esc to close</span>
        </div>
      </div>
    </div>
  {/if}
{/if}

<style>
  .mermaid-diagram-container {
    position: relative;
    margin: 1.5rem 0;
    background: #f8fafc; /* slate-50 */
    border: 1px solid #e2e8f0; /* slate-200 */
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05);
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }

  .mermaid-diagram-container:hover {
    border-color: #cbd5e1; /* slate-300 */
  }

  .diagram-header {
    padding: 0.625rem 1rem;
    background: #f1f5f9; /* slate-100 */
    border-bottom: 1px solid #e2e8f0;
  }

  .diagram-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: #0f172a; /* slate-900 */
  }

  .diagram-toolbar {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    z-index: 10;
    display: flex;
    align-items: center;
    gap: 0.375rem;
    background: rgba(255, 255, 255, 0.92);
    backdrop-filter: blur(4px);
    padding: 0.25rem;
    border-radius: 6px;
    border: 1px solid #e2e8f0;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s ease, box-shadow 0.2s ease;
  }

  .mermaid-diagram-container:hover .diagram-toolbar,
  .mermaid-diagram-container:focus-within .diagram-toolbar,
  .diagram-toolbar:focus-within {
    opacity: 1;
    pointer-events: auto;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  }

  .toolbar-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: #475569; /* slate-600 */
    background: transparent;
    border: 1px solid transparent;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s ease;
    user-select: none;
  }

  .toolbar-btn:hover {
    color: #0f172a;
    background: #f1f5f9;
    border-color: #cbd5e1;
  }

  .toolbar-btn:focus-visible {
    outline: 2px solid #2563eb;
    outline-offset: 1px;
  }

  .toolbar-btn.active {
    color: #2563eb;
    background: #eff6ff;
    border-color: #bfdbfe;
  }

  .btn-text {
    display: inline-block;
  }

  @media (max-width: 640px) {
    .btn-text {
      display: none;
    }
  }

  .diagram-content {
    position: relative;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 120px;
    overflow-x: auto;
  }

  .svg-viewport {
    width: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    overflow-x: auto;
    transition: opacity 0.2s ease;
  }

  .svg-viewport :global(svg) {
    max-width: 100%;
    height: auto;
    display: block;
    margin: 0 auto;
  }

  /* Error Boundary Banner */
  .error-boundary-banner {
    width: 100%;
    background: #fef2f2; /* red-50 */
    border: 1px solid #fecaca; /* red-200 */
    border-radius: 6px;
    padding: 1rem;
    color: #991b1b; /* red-800 */
  }

  .error-header {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
  }

  .error-icon {
    color: #ef4444; /* red-500 */
    flex-shrink: 0;
    margin-top: 0.125rem;
  }

  .error-details {
    flex: 1;
    min-width: 0;
  }

  .error-title {
    display: block;
    font-size: 0.875rem;
    font-weight: 600;
    color: #991b1b;
    margin-bottom: 0.25rem;
  }

  .error-message {
    font-size: 0.8125rem;
    color: #b91c1c;
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  }

  .error-fallback-code {
    margin-top: 0.75rem;
    border-top: 1px solid #fee2e2;
    padding-top: 0.5rem;
  }

  .fallback-header {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #b91c1c;
    margin-bottom: 0.375rem;
  }

  .error-fallback-code pre {
    background: #ffffff;
    border: 1px solid #fecaca;
    border-radius: 4px;
    padding: 0.625rem;
    font-size: 0.75rem;
    color: #334155;
    overflow-x: auto;
    margin: 0;
  }

  /* Raw Code Drawer */
  .raw-code-drawer {
    width: 100%;
    margin-top: 1rem;
    border-top: 1px solid #e2e8f0;
    padding-top: 0.75rem;
  }

  .raw-code-header {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #64748b;
    margin-bottom: 0.375rem;
  }

  .raw-code-drawer pre {
    background: #0f172a;
    border-radius: 6px;
    padding: 0.75rem 1rem;
    color: #f8fafc;
    font-size: 0.8125rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    overflow-x: auto;
    margin: 0;
  }

  /* Loading state */
  .diagram-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.625rem;
    color: #64748b;
    font-size: 0.8125rem;
    padding: 2rem 0;
  }

  .loading-spinner {
    width: 1.5rem;
    height: 1.5rem;
    border: 2px solid #e2e8f0;
    border-top-color: #2563eb;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* Modal Dialog Styles */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 9999;
    background: rgba(15, 23, 42, 0.75);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
    animation: modal-fade-in 0.15s ease-out;
  }

  @keyframes modal-fade-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .modal-dialog {
    background: #ffffff;
    border-radius: 12px;
    width: 100%;
    max-width: 90vw;
    height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow:
      0 20px 25px -5px rgba(0, 0, 0, 0.2),
      0 10px 10px -5px rgba(0, 0, 0, 0.1);
    overflow: hidden;
    outline: none;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1.25rem;
    background: #f8fafc;
    border-bottom: 1px solid #e2e8f0;
    flex-shrink: 0;
  }

  .modal-title-group {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .modal-title {
    font-size: 1rem;
    font-weight: 600;
    color: #0f172a;
    margin: 0;
  }

  .zoom-badge {
    font-size: 0.75rem;
    font-weight: 600;
    background: #e2e8f0;
    color: #334155;
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
  }

  .modal-controls {
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .modal-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 6px;
    color: #475569;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .modal-btn:hover:not(:disabled) {
    background: #e2e8f0;
    color: #0f172a;
  }

  .modal-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .modal-btn:focus-visible {
    outline: 2px solid #2563eb;
  }

  .modal-divider {
    width: 1px;
    height: 1.25rem;
    background: #cbd5e1;
    margin: 0 0.25rem;
  }

  .modal-close-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 6px;
    color: #64748b;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .modal-close-btn:hover {
    background: #fee2e2;
    color: #dc2626;
  }

  .modal-close-btn:focus-visible {
    outline: 2px solid #ef4444;
  }

  .modal-canvas {
    flex: 1;
    position: relative;
    background: #f1f5f9;
    background-image: radial-gradient(#cbd5e1 1px, transparent 1px);
    background-size: 20px 20px;
    overflow: hidden;
    cursor: grab;
    user-select: none;
    touch-action: none;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .modal-canvas.is-dragging {
    cursor: grabbing;
  }

  .modal-svg-wrapper {
    will-change: transform;
    transition: transform 0.05s ease-out;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
  }

  .modal-svg-wrapper :global(svg) {
    max-width: none;
    height: auto;
    filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.08));
    pointer-events: auto;
  }

  .modal-footer-hint {
    padding: 0.375rem 1rem;
    background: #f8fafc;
    border-top: 1px solid #e2e8f0;
    font-size: 0.75rem;
    color: #64748b;
    text-align: center;
    flex-shrink: 0;
  }

  /* SSR Fallback */
  .mermaid-block {
    margin: 1.5rem 0;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 1rem;
  }

  .mermaid-block pre {
    margin: 0;
    background: transparent;
    font-size: 0.875rem;
  }
</style>
