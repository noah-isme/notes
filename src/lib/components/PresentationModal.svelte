<script lang="ts">
  import { extractSlides, type SlideData } from '$lib/utils/slides';
  import { mermaidRenderer } from '$lib/actions/mermaid';
  import {
    IconArrowLeft,
    IconClose,
    IconMaximize,
    IconPresentation,
  } from './icons';

  interface Props {
    isOpen: boolean;
    noteTitle?: string;
    markdownContent?: string;
    onClose: () => void;
  }

  let {
    isOpen = false,
    noteTitle = 'Presentation',
    markdownContent = '',
    onClose,
  }: Props = $props();

  let currentIndex = $state(0);
  let isFullscreen = $state(false);
  let presentationContainer = $state<HTMLDivElement | null>(null);

  let slides = $derived<SlideData[]>(extractSlides(markdownContent));
  let currentSlide = $derived(slides[currentIndex] || slides[0]);
  let progressPercent = $derived(
    slides.length > 1 ? Math.round(((currentIndex + 1) / slides.length) * 100) : 100
  );

  function next() {
    if (currentIndex < slides.length - 1) {
      currentIndex += 1;
    }
  }

  function prev() {
    if (currentIndex > 0) {
      currentIndex -= 1;
    }
  }

  function goTo(idx: number) {
    if (idx >= 0 && idx < slides.length) {
      currentIndex = idx;
    }
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      presentationContainer?.requestFullscreen?.().catch(() => {});
      isFullscreen = true;
    } else {
      document.exitFullscreen?.().catch(() => {});
      isFullscreen = false;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!isOpen) return;

    if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      next();
    } else if (e.key === 'ArrowLeft' || e.key === 'PageUp' || e.key === 'Backspace') {
      e.preventDefault();
      prev();
    } else if (e.key === 'Home') {
      e.preventDefault();
      goTo(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      goTo(slides.length - 1);
    } else if (e.key === 'f' || e.key === 'F') {
      e.preventDefault();
      toggleFullscreen();
    } else if (e.key === 'Escape') {
      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
        isFullscreen = false;
      } else {
        onClose();
      }
    }
  }

  $effect(() => {
    if (isOpen) {
      currentIndex = 0;
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      }
      isFullscreen = false;
    }

    return () => {
      document.body.style.overflow = '';
    };
  });
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
  <div
    bind:this={presentationContainer}
    class="presentation-overlay"
    role="dialog"
    aria-modal="true"
    aria-label={`Presentation: ${noteTitle}`}
  >
    <!-- Top Presentation Header Bar -->
    <header class="presentation-header">
      <div class="header-left">
        <span class="pres-badge">
          <IconPresentation size={14} />
          <span>SLIDES</span>
        </span>
        <h2 class="pres-note-title" title={noteTitle}>{noteTitle}</h2>
      </div>

      <div class="header-center">
        <select
          class="slide-jump-select"
          value={currentIndex}
          onchange={(e) => goTo(Number((e.target as HTMLSelectElement).value))}
          aria-label="Jump to slide"
        >
          {#each slides as slide, idx}
            <option value={idx}>
              {idx + 1}. {slide.title}
            </option>
          {/each}
        </select>
        <span class="slide-count-indicator">
          {currentIndex + 1} / {slides.length}
        </span>
      </div>

      <div class="header-right">
        <button
          type="button"
          class="btn-header-action"
          onclick={toggleFullscreen}
          title="Toggle Fullscreen (F)"
          aria-label="Toggle Fullscreen"
        >
          <IconMaximize size={16} />
        </button>
        <button
          type="button"
          class="btn-header-action btn-close-action"
          onclick={onClose}
          title="Exit Presentation (Esc)"
          aria-label="Exit Presentation"
        >
          <IconClose size={16} />
        </button>
      </div>
    </header>

    <!-- Main Slide Stage Area -->
    <main class="slide-stage">
      <button
        type="button"
        class="nav-trigger-edge left"
        onclick={prev}
        disabled={currentIndex === 0}
        aria-label="Previous slide"
      >
        <span class="nav-arrow-bubble">
          <IconArrowLeft size={20} />
        </span>
      </button>

      <div class="slide-card-wrapper">
        <article class="slide-card">
          {#key currentIndex}
            <div
              class="slide-markdown-content"
              use:mermaidRenderer={currentSlide.renderedHtml}
            >
              <!-- eslint-disable-next-line svelte/no-at-html-tags -->
              {@html currentSlide.renderedHtml}
            </div>
          {/key}
        </article>
      </div>

      <button
        type="button"
        class="nav-trigger-edge right"
        onclick={next}
        disabled={currentIndex === slides.length - 1}
        aria-label="Next slide"
      >
        <span class="nav-arrow-bubble rotate-180">
          <IconArrowLeft size={20} />
        </span>
      </button>
    </main>

    <!-- Bottom Controls & Progress -->
    <footer class="presentation-footer">
      <div class="footer-nav-controls">
        <button
          type="button"
          class="btn-nav-control"
          onclick={prev}
          disabled={currentIndex === 0}
          title="Previous (Left Arrow / Backspace)"
        >
          <IconArrowLeft size={14} />
          <span>Prev</span>
        </button>

        <div class="slide-dots">
          {#each slides as _, i}
            <button
              type="button"
              class="dot-indicator"
              class:active={i === currentIndex}
              onclick={() => goTo(i)}
              aria-label={`Go to slide ${i + 1}`}
            ></button>
          {/each}
        </div>

        <button
          type="button"
          class="btn-nav-control"
          onclick={next}
          disabled={currentIndex === slides.length - 1}
          title="Next (Right Arrow / Space)"
        >
          <span>Next</span>
          <span class="rotate-180 inline-flex">
            <IconArrowLeft size={14} />
          </span>
        </button>
      </div>

      <!-- Linear Slide Progress Bar -->
      <div
        class="pres-progress-bar"
        role="progressbar"
        aria-valuenow={progressPercent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div class="progress-fill" style:width="{progressPercent}%"></div>
      </div>
    </footer>
  </div>
{/if}

<style>
  .presentation-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 100000;
    background: #090d16;
    color: #f8fafc;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    user-select: none;
  }

  /* Header Bar */
  .presentation-header {
    height: 56px;
    padding: 0 1.5rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: rgba(15, 23, 42, 0.85);
    backdrop-filter: blur(12px);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    z-index: 10;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-width: 0;
    flex: 1;
  }

  .pres-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.3125rem;
    padding: 0.2rem 0.5rem;
    background: rgba(37, 99, 235, 0.2);
    border: 1px solid rgba(37, 99, 235, 0.4);
    color: #60a5fa;
    border-radius: 4px;
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.05em;
  }

  .pres-note-title {
    margin: 0;
    font-size: 0.9375rem;
    font-weight: 600;
    color: #f1f5f9;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 400px;
  }

  .header-center {
    display: flex;
    align-items: center;
    gap: 0.625rem;
  }

  .slide-jump-select {
    background: rgba(30, 41, 59, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: #e2e8f0;
    padding: 0.25rem 0.625rem;
    font-size: 0.8125rem;
    border-radius: 6px;
    outline: none;
    cursor: pointer;
    max-width: 260px;
  }

  .slide-jump-select:focus {
    border-color: #3b82f6;
  }

  .slide-count-indicator {
    font-size: 0.8125rem;
    font-weight: 600;
    color: #94a3b8;
    min-width: 54px;
    text-align: right;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex: 1;
    justify-content: flex-end;
  }

  .btn-header-action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #94a3b8;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-header-action:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #ffffff;
    border-color: rgba(255, 255, 255, 0.2);
  }

  .btn-close-action:hover {
    background: rgba(239, 68, 68, 0.2);
    border-color: rgba(239, 68, 68, 0.4);
    color: #f87171;
  }

  /* Slide Stage */
  .slide-stage {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.5rem 1rem;
    overflow: hidden;
    position: relative;
  }

  .nav-trigger-edge {
    background: transparent;
    border: none;
    width: 64px;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 5;
    opacity: 0.4;
    transition: opacity 0.2s ease;
  }

  .nav-trigger-edge:hover:not(:disabled) {
    opacity: 1;
  }

  .nav-trigger-edge:disabled {
    opacity: 0.1;
    cursor: not-allowed;
  }

  .nav-arrow-bubble {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: rgba(30, 41, 59, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: #f1f5f9;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.3);
    transition: transform 0.15s ease, background 0.15s ease;
  }

  .nav-trigger-edge:hover:not(:disabled) .nav-arrow-bubble {
    transform: scale(1.08);
    background: #2563eb;
    border-color: #3b82f6;
  }

  .rotate-180 {
    transform: rotate(180deg);
  }

  /* Slide Card */
  .slide-card-wrapper {
    flex: 1;
    max-width: 1100px;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.5rem;
    box-sizing: border-box;
  }

  .slide-card {
    width: 100%;
    max-height: 100%;
    aspect-ratio: 16 / 9;
    background: #0f172a;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    box-shadow:
      0 20px 50px rgba(0, 0, 0, 0.6),
      0 0 0 1px rgba(255, 255, 255, 0.05);
    padding: 2.5rem 3rem;
    box-sizing: border-box;
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
    user-select: text;
    display: flex;
    flex-direction: column;
    animation: slide-fade 0.22s cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes slide-fade {
    from {
      opacity: 0.7;
      transform: translateY(6px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* Slide Markdown Typography */
  .slide-markdown-content {
    font-size: 1.0625rem;
    line-height: 1.65;
    color: #e2e8f0;
    word-break: break-word;
  }

  :global(.slide-markdown-content h1) {
    font-size: 2rem;
    font-weight: 700;
    color: #ffffff;
    margin-top: 0;
    margin-bottom: 1rem;
    border-bottom: 2px solid rgba(37, 99, 235, 0.5);
    padding-bottom: 0.5rem;
    letter-spacing: -0.01em;
  }

  :global(.slide-markdown-content h2) {
    font-size: 1.5rem;
    font-weight: 600;
    color: #60a5fa;
    margin-top: 1.25rem;
    margin-bottom: 0.75rem;
  }

  :global(.slide-markdown-content h3) {
    font-size: 1.2rem;
    font-weight: 600;
    color: #93c5fd;
    margin-top: 1rem;
    margin-bottom: 0.5rem;
  }

  :global(.slide-markdown-content p) {
    margin-top: 0;
    margin-bottom: 0.875rem;
  }

  :global(.slide-markdown-content ul, .slide-markdown-content ol) {
    margin-top: 0;
    margin-bottom: 0.875rem;
    padding-left: 1.75rem;
  }

  :global(.slide-markdown-content li) {
    margin-bottom: 0.35rem;
  }

  :global(.slide-markdown-content blockquote) {
    border-left: 4px solid #3b82f6;
    background: rgba(30, 41, 59, 0.6);
    padding: 0.75rem 1.25rem;
    border-radius: 0 8px 8px 0;
    color: #cbd5e1;
    margin: 1rem 0;
    font-style: italic;
  }

  :global(.slide-markdown-content code) {
    background: rgba(255, 255, 255, 0.1);
    color: #93c5fd;
    padding: 0.15rem 0.4rem;
    border-radius: 4px;
    font-family: ui-monospace, "JetBrains Mono", Menlo, Consolas, monospace;
    font-size: 0.9em;
  }

  :global(.slide-markdown-content pre) {
    background: #030712;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 1rem;
    overflow-x: auto;
    margin: 1rem 0;
  }

  :global(.slide-markdown-content table) {
    width: 100%;
    border-collapse: collapse;
    margin: 1rem 0;
    font-size: 0.9375rem;
  }

  :global(.slide-markdown-content th, .slide-markdown-content td) {
    border: 1px solid rgba(255, 255, 255, 0.12);
    padding: 0.625rem 0.875rem;
    text-align: left;
  }

  :global(.slide-markdown-content th) {
    background: rgba(30, 41, 59, 0.9);
    color: #60a5fa;
    font-weight: 600;
  }

  :global(.slide-markdown-content img) {
    max-width: 100%;
    max-height: 480px;
    object-fit: contain;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    margin: 0.75rem auto;
    display: block;
  }

  /* Footer Controls */
  .presentation-footer {
    height: 54px;
    background: rgba(15, 23, 42, 0.85);
    backdrop-filter: blur(12px);
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    flex-direction: column;
    justify-content: center;
    position: relative;
    z-index: 10;
  }

  .footer-nav-controls {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1.5rem;
    padding: 0 1rem;
  }

  .btn-nav-control {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    background: rgba(30, 41, 59, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: #f1f5f9;
    padding: 0.3125rem 0.75rem;
    border-radius: 6px;
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-nav-control:hover:not(:disabled) {
    background: #2563eb;
    border-color: #3b82f6;
  }

  .btn-nav-control:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .slide-dots {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    max-width: 420px;
    overflow-x: auto;
    padding: 0.25rem;
  }

  .dot-indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.2);
    border: none;
    padding: 0;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .dot-indicator:hover {
    background: rgba(255, 255, 255, 0.5);
  }

  .dot-indicator.active {
    width: 20px;
    border-radius: 4px;
    background: #3b82f6;
    box-shadow: 0 0 8px rgba(59, 130, 246, 0.6);
  }

  /* Linear Progress Fill */
  .pres-progress-bar {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: rgba(255, 255, 255, 0.05);
  }

  .progress-fill {
    height: 100%;
    background: #3b82f6;
    box-shadow: 0 0 6px rgba(59, 130, 246, 0.8);
    transition: width 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  }

  /* Mobile responsiveness */
  @media (max-width: 768px) {
    .nav-trigger-edge {
      display: none;
    }

    .pres-note-title {
      max-width: 180px;
    }

    .slide-jump-select {
      max-width: 160px;
    }

    .slide-card {
      aspect-ratio: auto;
      height: 100%;
      padding: 1.5rem;
    }
  }
</style>
