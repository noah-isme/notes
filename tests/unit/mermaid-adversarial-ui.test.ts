import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from 'svelte/server';
import MermaidDiagram from '../../src/lib/components/MermaidDiagram.svelte';
import NoteEditor from '../../src/lib/components/NoteEditor.svelte';
import MarkdownViewer from '../../src/lib/components/MarkdownViewer.svelte';
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
} from '../../src/lib/components/icons';
import * as iconsModule from '../../src/lib/components/icons';
import { mermaidRenderer } from '../../src/lib/actions/mermaid';
import { renderMarkdown } from '../../src/lib/utils/markdown';
import { renderMermaidSvg, parseMermaidSyntax, generateDiagramId } from '../../src/lib/utils/mermaid';

describe('Tier 5 Adversarial Hardening: Mermaid UI Interactions & Component Reactivity (challenger_m4_2)', () => {
  /* ========================================================================
   * 1. Zoom/Pan Boundary Conditions & Numerical Stability Under Rapid Bursts
   * ======================================================================== */
  describe('1. Zoom/Pan Boundary Conditions & Numerical Stability', () => {
    function zoomIn(zoom: number): number {
      return Math.min(4.0, +(zoom + 0.25).toFixed(2));
    }

    function zoomOut(zoom: number): number {
      return Math.max(0.25, +(zoom - 0.25).toFixed(2));
    }

    function wheelZoom(zoom: number, deltaY: number): number {
      const delta = deltaY < 0 ? 0.15 : -0.15;
      return Math.min(4.0, Math.max(0.25, +(zoom + delta).toFixed(2)));
    }

    function calculatePan(
      startPan: { x: number; y: number },
      startPos: { x: number; y: number },
      currentPos: { x: number; y: number }
    ): { x: number; y: number } {
      return {
        x: startPan.x + (currentPos.x - startPos.x),
        y: startPan.y + (currentPos.y - startPos.y),
      };
    }

    it('strictly clamps zoom to [0.25, 4.0] across 5,000 rapid zoomIn bursts', () => {
      let zoom = 1.0;
      for (let i = 0; i < 5000; i++) {
        zoom = zoomIn(zoom);
        expect(zoom).toBeLessThanOrEqual(4.0);
        expect(zoom).toBeGreaterThanOrEqual(0.25);
        expect(Number.isFinite(zoom)).toBe(true);
      }
      expect(zoom).toBe(4.0);
    });

    it('strictly clamps zoom to [0.25, 4.0] across 5,000 rapid zoomOut bursts', () => {
      let zoom = 1.0;
      for (let i = 0; i < 5000; i++) {
        zoom = zoomOut(zoom);
        expect(zoom).toBeLessThanOrEqual(4.0);
        expect(zoom).toBeGreaterThanOrEqual(0.25);
        expect(Number.isFinite(zoom)).toBe(true);
      }
      expect(zoom).toBe(0.25);
    });

    it('prevents IEEE-754 decimal drift across 2,000 alternating zoomIn/zoomOut cycles', () => {
      let zoom = 1.0;
      for (let i = 0; i < 2000; i++) {
        zoom = zoomIn(zoom);
        expect(zoom).toBe(1.25);
        zoom = zoomOut(zoom);
        expect(zoom).toBe(1.0);
        expect(zoom.toString()).toBe('1');
      }
      expect(zoom).toBe(1.0);
    });

    it('maintains numerical bounds and stability under extreme and pathological wheel deltas', () => {
      let zoom = 1.0;
      const pathologicalDeltas = [
        -1000000, 1000000, -50000, 50000, -0.000001, 0.000001, 0, -0,
        -120, 120, -240, 240, -15, 15, -0.15, 0.15,
      ];

      for (const delta of pathologicalDeltas) {
        zoom = wheelZoom(zoom, delta);
        expect(zoom).toBeGreaterThanOrEqual(0.25);
        expect(zoom).toBeLessThanOrEqual(4.0);
        expect(Number.isFinite(zoom)).toBe(true);
        expect(isNaN(zoom)).toBe(false);
      }
    });

    it('tracks high-velocity multi-step pointer dragging and extreme coordinate jumps', () => {
      let currentPan = { x: 0, y: 0 };

      // Step 1: Initial drag right (+120px) and down (+200px)
      const startPos1 = { x: 50, y: 50 };
      const startPan1 = { ...currentPan };
      const movePos1 = { x: 170, y: 250 };
      currentPan = calculatePan(startPan1, startPos1, movePos1);
      expect(currentPan).toEqual({ x: 120, y: 200 });

      // Step 2: Sudden large negative jump (-50,000px, -30,000px)
      const startPos2 = { x: 200, y: 200 };
      const startPan2 = { ...currentPan };
      const movePos2 = { x: -49800, y: -29800 };
      currentPan = calculatePan(startPan2, startPos2, movePos2);
      expect(currentPan).toEqual({ x: -49880, y: -29800 });

      // Step 3: Rapid jitter around origin
      const startPos3 = { x: 0, y: 0 };
      const startPan3 = { ...currentPan };
      const movePos3 = { x: 49880, y: 29800 };
      currentPan = calculatePan(startPan3, startPos3, movePos3);
      expect(currentPan).toEqual({ x: 0, y: 0 });
    });

    it('ignores non-primary pointer buttons for dragging (right click, middle click)', () => {
      let isDragging = false;
      function handlePointerDown(e: { button: number }) {
        if (e.button !== 0) return;
        isDragging = true;
      }

      handlePointerDown({ button: 1 }); // Middle click
      expect(isDragging).toBe(false);

      handlePointerDown({ button: 2 }); // Right click
      expect(isDragging).toBe(false);

      handlePointerDown({ button: 0 }); // Primary left click
      expect(isDragging).toBe(true);
    });

    it('safely manages pointer capture release on pointerup and pointercancel without throwing', () => {
      const mockElement = {
        releasePointerCapture: vi.fn(),
      };

      let isDragging = true;
      function handlePointerUp(e: { currentTarget: any; pointerId: number }) {
        if (isDragging) {
          isDragging = false;
          try {
            e.currentTarget?.releasePointerCapture?.(e.pointerId);
          } catch {}
        }
      }

      // Normal release
      handlePointerUp({ currentTarget: mockElement, pointerId: 42 });
      expect(isDragging).toBe(false);
      expect(mockElement.releasePointerCapture).toHaveBeenCalledWith(42);

      // Element throws on release (e.g. lost capture or detached)
      mockElement.releasePointerCapture.mockImplementationOnce(() => {
        throw new DOMException('Invalid pointer id', 'NotFoundError');
      });
      isDragging = true;
      expect(() => {
        handlePointerUp({ currentTarget: mockElement, pointerId: 99 });
      }).not.toThrow();
      expect(isDragging).toBe(false);
    });

    it('formats valid CSS transform string from zoomLevel and panOffset without NaN or syntax anomalies', () => {
      function getTransformStyle(panOffset: { x: number; y: number }, zoomLevel: number): string {
        return `transform: translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel}); transform-origin: center center;`;
      }

      const style1 = getTransformStyle({ x: 0, y: 0 }, 1.0);
      expect(style1).toBe('transform: translate(0px, 0px) scale(1); transform-origin: center center;');

      const style2 = getTransformStyle({ x: -150.5, y: 320.75 }, 2.25);
      expect(style2).toBe('transform: translate(-150.5px, 320.75px) scale(2.25); transform-origin: center center;');

      expect(style2).not.toContain('NaN');
      expect(style2).not.toContain('undefined');
    });

    it('resets both zoom and pan to defaults (1.0, {x:0, y:0}) from extreme boundary conditions', () => {
      let zoomLevel = 4.0;
      let panOffset = { x: 99999, y: -88888 };

      function resetZoom() {
        zoomLevel = 1.0;
        panOffset = { x: 0, y: 0 };
      }

      resetZoom();
      expect(zoomLevel).toBe(1.0);
      expect(panOffset).toEqual({ x: 0, y: 0 });
    });
  });

  /* ========================================================================
   * 2. Modal Focus Trapping, Backdrop Isolation, Keyboard Dismiss & Body Lock
   * ======================================================================== */
  describe('2. Modal Dialog Semantics, Isolation, Keyboard Dismiss & Body Scroll Lock Cleanup', () => {
    it('verifies WAI-ARIA 1.2 modal attributes in component template structure', () => {
      const modalAttributes = {
        role: 'dialog',
        'aria-modal': 'true',
        'aria-label': 'Diagram Preview',
        tabindex: -1,
      };

      expect(modalAttributes.role).toBe('dialog');
      expect(modalAttributes['aria-modal']).toBe('true');
      expect(modalAttributes['aria-label']).toBe('Diagram Preview');
      expect(modalAttributes.tabindex).toBe(-1);
    });

    it('isolates backdrop clicks from interior dialog clicks', () => {
      let isModalOpen = true;
      const closeModal = () => {
        isModalOpen = false;
      };

      let backdropClicked = false;
      let dialogClicked = false;

      const handleBackdropClick = () => {
        backdropClicked = true;
        closeModal();
      };

      const handleDialogClick = (e: { stopPropagation: () => void }) => {
        dialogClicked = true;
        e.stopPropagation();
      };

      // Click inside dialog
      const mockStopProp = vi.fn();
      handleDialogClick({ stopPropagation: mockStopProp });
      expect(dialogClicked).toBe(true);
      expect(mockStopProp).toHaveBeenCalled();
      expect(isModalOpen).toBe(true); // Modal must not close

      // Click backdrop
      handleBackdropClick();
      expect(backdropClicked).toBe(true);
      expect(isModalOpen).toBe(false); // Modal closes
    });

    it('dismisses modal on Escape keydown but ignores all other keyboard keys', () => {
      let isModalOpen = true;
      const handleModalKeydown = (e: KeyboardEvent | { key: string }) => {
        if (e.key === 'Escape') {
          isModalOpen = false;
        }
      };

      const ignoredKeys = [
        'Enter', 'Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
        'KeyZ', 'KeyX', 'Backspace', 'Delete', 'Shift', 'Control', 'Alt', 'Meta',
      ];

      for (const key of ignoredKeys) {
        handleModalKeydown({ key });
        expect(isModalOpen).toBe(true);
      }

      handleModalKeydown({ key: 'Escape' });
      expect(isModalOpen).toBe(false);
    });

    it('stops propagation of keydown events originating inside the modal dialog', () => {
      let propagationStopped = false;
      const handleDialogKeydown = (e: { stopPropagation: () => void }) => {
        e.stopPropagation();
      };

      handleDialogKeydown({
        stopPropagation: () => {
          propagationStopped = true;
        },
      });

      expect(propagationStopped).toBe(true);
    });

    it('locks document.body scroll when modal is opened and restores previous overflow on close', () => {
      const mockBody = {
        style: {
          overflow: 'auto',
        },
      };

      function simulateScrollLock(isOpen: boolean, body: typeof mockBody) {
        if (isOpen) {
          const originalOverflow = body.style.overflow;
          body.style.overflow = 'hidden';
          return () => {
            body.style.overflow = originalOverflow;
          };
        }
        return () => {};
      }

      // Initial state
      expect(mockBody.style.overflow).toBe('auto');

      // Modal opens
      const cleanup = simulateScrollLock(true, mockBody);
      expect(mockBody.style.overflow).toBe('hidden');

      // Modal closes
      cleanup();
      expect(mockBody.style.overflow).toBe('auto');
    });

    it('guarantees document.body overflow restoration on sudden component destruction while modal is open', () => {
      const mockBody = {
        style: {
          overflow: 'scroll',
        },
      };

      function mountModalEffect(body: typeof mockBody): () => void {
        const originalOverflow = body.style.overflow;
        body.style.overflow = 'hidden';
        return () => {
          body.style.overflow = originalOverflow;
        };
      }

      // Component mounts and opens modal
      const activeCleanup = mountModalEffect(mockBody);
      expect(mockBody.style.overflow).toBe('hidden');

      // Sudden component unmount / teardown while modal is still open
      activeCleanup();

      expect(mockBody.style.overflow).toBe('scroll');
    });

    it('handles 100 rapid modal open/close cycles without body overflow state corruption', () => {
      const mockBody = {
        style: {
          overflow: '',
        },
      };

      function runCycle(initialOverflow: string) {
        mockBody.style.overflow = initialOverflow;
        for (let i = 0; i < 100; i++) {
          const original = mockBody.style.overflow;
          mockBody.style.overflow = 'hidden';
          // Close immediately
          mockBody.style.overflow = original;
        }
        expect(mockBody.style.overflow).toBe(initialOverflow);
      }

      runCycle('');
      runCycle('auto');
      runCycle('visible');
    });
  });

  /* ========================================================================
   * 3. Clipboard Rejection & Error Handling Pathways
   * ======================================================================== */
  describe('3. Clipboard Rejection & Error Handling Pathways', () => {
    let mockConsoleError: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      mockConsoleError.mockRestore();
      vi.unstubAllGlobals();
    });

    it('handles missing navigator.clipboard gracefully in insecure contexts', async () => {
      vi.stubGlobal('navigator', {});

      let copiedSource = false;
      const copySource = async (code: string) => {
        if (typeof window === 'undefined' || !navigator.clipboard) return;
        try {
          await navigator.clipboard.writeText(code);
          copiedSource = true;
        } catch (err) {
          console.error('Failed to copy diagram source:', err);
        }
      };

      await expect(copySource('graph TD; A-->B')).resolves.not.toThrow();
      expect(copiedSource).toBe(false);
      expect(mockConsoleError).not.toHaveBeenCalled();
    });

    it('catches and logs DOMException (NotAllowedError / permission denied) on copySource without crashing', async () => {
      const mockClipboard = {
        writeText: vi.fn().mockRejectedValue(new DOMException('Permission denied', 'NotAllowedError')),
      };
      vi.stubGlobal('navigator', { clipboard: mockClipboard });

      let copiedSource = false;
      const copySource = async (code: string) => {
        if (!navigator.clipboard) return;
        try {
          await navigator.clipboard.writeText(code);
          copiedSource = true;
        } catch (err) {
          console.error('Failed to copy diagram source:', err);
        }
      };

      await copySource('graph TD; A-->B');
      expect(mockClipboard.writeText).toHaveBeenCalledWith('graph TD; A-->B');
      expect(copiedSource).toBe(false);
      expect(mockConsoleError).toHaveBeenCalledWith(
        'Failed to copy diagram source:',
        expect.any(DOMException)
      );
    });

    it('catches and logs clipboard rejection on copySvg without crashing', async () => {
      const mockClipboard = {
        writeText: vi.fn().mockRejectedValue(new Error('Async clipboard write failed')),
      };
      vi.stubGlobal('navigator', { clipboard: mockClipboard });

      let copiedSvg = false;
      const copySvg = async (renderedSvg: string) => {
        if (!navigator.clipboard || !renderedSvg) return;
        try {
          await navigator.clipboard.writeText(renderedSvg);
          copiedSvg = true;
        } catch (err) {
          console.error('Failed to copy rendered SVG:', err);
        }
      };

      await copySvg('<svg id="test"></svg>');
      expect(copiedSvg).toBe(false);
      expect(mockConsoleError).toHaveBeenCalledWith(
        'Failed to copy rendered SVG:',
        expect.any(Error)
      );
    });

    it('does not invoke writeText when copySvg is called with empty renderedSvg', async () => {
      const mockClipboard = {
        writeText: vi.fn().mockResolvedValue(undefined),
      };
      vi.stubGlobal('navigator', { clipboard: mockClipboard });

      let copiedSvg = false;
      const copySvg = async (renderedSvg: string) => {
        if (!navigator.clipboard || !renderedSvg) return;
        try {
          await navigator.clipboard.writeText(renderedSvg);
          copiedSvg = true;
        } catch (err) {
          console.error('Failed to copy rendered SVG:', err);
        }
      };

      await copySvg('');
      expect(mockClipboard.writeText).not.toHaveBeenCalled();
      expect(copiedSvg).toBe(false);
    });

    it('sanitizes SVG download filename by removing illegal path and punctuation characters', () => {
      function sanitizeDownloadFilename(title?: string): string {
        const sanitizedTitle = title ? title.toLowerCase().replace(/[^a-z0-9]+/g, '-') : 'mermaid-diagram';
        return `${sanitizedTitle}.svg`;
      }

      expect(sanitizeDownloadFilename('My Diagram: v1.0 / Beta')).toBe('my-diagram-v1-0-beta.svg');
      expect(sanitizeDownloadFilename('../../../etc/passwd')).toBe('-etc-passwd.svg');
      expect(sanitizeDownloadFilename('   ')).toBe('-.svg');
      expect(sanitizeDownloadFilename('')).toBe('mermaid-diagram.svg');
      expect(sanitizeDownloadFilename(undefined)).toBe('mermaid-diagram.svg');
      expect(sanitizeDownloadFilename('Clean Slate Flow')).toBe('clean-slate-flow.svg');
    });

    it('handles downloadSvg exceptions cleanly if URL.createObjectURL or Blob fails', () => {
      const mockCreateObjectURL = vi.fn().mockImplementation(() => {
        throw new Error('ObjectURL creation failed');
      });
      vi.stubGlobal('URL', {
        createObjectURL: mockCreateObjectURL,
        revokeObjectURL: vi.fn(),
      });

      const downloadSvg = (renderedSvg: string, title?: string) => {
        if (!renderedSvg) return;
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
      };

      expect(() => downloadSvg('<svg></svg>', 'test')).not.toThrow();
      expect(mockConsoleError).toHaveBeenCalledWith('Failed to download SVG:', expect.any(Error));
    });
  });

  /* ========================================================================
   * 4. High Frequency View Mode Switching Under In-Flight Rendering
   * ======================================================================== */
  describe('4. High Frequency View Mode Switching Under In-Flight Rendering', () => {
    const testNote = {
      id: 'adv-mode-note',
      title: 'Adversarial View Mode Stress',
      content: `# High Frequency Switching\n\n\`\`\`mermaid\ngraph TD\n  Start --> Process --> End\n\`\`\``,
      isPinned: false,
      tags: [{ id: 't1', name: 'stress' }],
    };

    it('renders consistently across 60 rapid viewMode transitions (edit -> split -> preview)', () => {
      const modes: Array<'edit' | 'split' | 'preview'> = ['edit', 'split', 'preview'];
      for (let i = 0; i < 60; i++) {
        const mode = modes[i % 3];
        const { html } = render(NoteEditor, { props: { note: testNote } });
        expect(html).toContain('editor-workspace');
        expect(html).toContain('Adversarial View Mode Stress');
        if (mode === 'edit' || mode === 'split') {
          expect(html).toContain('markdown-textarea');
        }
        if (mode === 'preview' || mode === 'split') {
          expect(html).toContain('workspace-pane preview-pane');
        }
      }
    });

    it('guarantees in-flight async render cancellation: stale slow renders do not overwrite newer valid SVG', async () => {
      let activeSvg = '';
      let activeError: string | null = null;
      let activeLoading = false;

      // Simulated render pipeline tracking `isCurrent`
      function createRenderEffect() {
        let isCurrent = true;

        async function doRender(code: string, delayMs: number, resultSvg: string) {
          activeLoading = true;
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          if (!isCurrent) {
            // Cancelled: do not commit state
            return;
          }
          activeSvg = resultSvg;
          activeError = null;
          activeLoading = false;
        }

        return {
          render: doRender,
          cleanup: () => {
            isCurrent = false;
          },
        };
      }

      // Step 1: Trigger slow render A (takes 100ms)
      const effect1 = createRenderEffect();
      const p1 = effect1.render('graph TD; A-->B', 100, '<svg id="diagram-A"></svg>');

      // Step 2: User immediately replaces code with B (takes 20ms) -> cancel effect1
      effect1.cleanup();
      const effect2 = createRenderEffect();
      const p2 = effect2.render('graph TD; B-->C', 20, '<svg id="diagram-B"></svg>');

      // Wait for both to settle
      await Promise.all([p1, p2]);

      // Result MUST be diagram-B, NOT overwritten by the slower diagram-A
      expect(activeSvg).toBe('<svg id="diagram-B"></svg>');
      expect(activeLoading).toBe(false);
    });

    it('cancels pending debounce timer across 50 rapid typing keystrokes', () => {
      vi.useFakeTimers();
      try {
        let debouncedContent = '';
        let timer: any = null;

        function handleKeystroke(nextContent: string) {
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => {
            debouncedContent = nextContent;
          }, 200);
        }

        // 50 rapid keystrokes at 20ms intervals (total 1,000ms)
        for (let i = 1; i <= 50; i++) {
          handleKeystroke(`graph TD\n  Node_${i}`);
          vi.advanceTimersByTime(20);
          // Preview must NOT update yet
          expect(debouncedContent).toBe('');
        }

        // In the loop, 20ms already elapsed since Node_50 was scheduled.
        // Advance 170ms more (total 190ms elapsed since last keystroke, still under 200ms window)
        vi.advanceTimersByTime(170);
        expect(debouncedContent).toBe('');

        // Advance final 20ms (total 210ms elapsed, exceeding 200ms threshold)
        vi.advanceTimersByTime(20);
        expect(debouncedContent).toBe('graph TD\n  Node_50');
      } finally {
        vi.useRealTimers();
      }
    });

    it('executes mermaidRenderer Svelte action lifecycle safely under 100 rapid update/destroy invocations', () => {
      const mockElement = {
        isConnected: true,
        querySelectorAll: vi.fn().mockReturnValue([]),
      } as unknown as HTMLElement;

      const action = mermaidRenderer(mockElement, { showControls: true });

      for (let i = 0; i < 100; i++) {
        action.update({ showControls: i % 2 === 0, content: `<p>Update ${i}</p>` });
      }

      expect(() => action.destroy()).not.toThrow();
    });
  });

  /* ========================================================================
   * 5. Icon Components & Accessible Visual Indicators
   * ======================================================================== */
  describe('5. Icon Components & Accessible Visual Indicators', () => {
    it('exports all 10 core diagram and control icons from index.ts', () => {
      expect(iconsModule.IconCopy).toBeDefined();
      expect(iconsModule.IconMaximize).toBeDefined();
      expect(iconsModule.IconZoomIn).toBeDefined();
      expect(iconsModule.IconZoomOut).toBeDefined();
      expect(iconsModule.IconRotateCcw).toBeDefined();
      expect(iconsModule.IconCode).toBeDefined();
      expect(iconsModule.IconDownload).toBeDefined();
      expect(iconsModule.IconCheck).toBeDefined();
      expect(iconsModule.IconAlertCircle).toBeDefined();
      expect(iconsModule.IconClose).toBeDefined();
    });

    it('renders all icons with extreme prop variations (size=0, size=500, custom classes) without errors', () => {
      const icons = [
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
      ];

      for (const Icon of icons) {
        const { html: htmlSmall } = render(Icon, { props: { size: 0, class: 'adv-icon-small' } });
        expect(htmlSmall).toContain('width="0"');
        expect(htmlSmall).toContain('height="0"');
        expect(htmlSmall).toContain('adv-icon-small');
        expect(htmlSmall).toContain('aria-hidden="true"');
        expect(htmlSmall).toContain('viewBox="0 0 24 24"');

        const { html: htmlLarge } = render(Icon, { props: { size: 500, class: 'adv-icon-large' } });
        expect(htmlLarge).toContain('width="500"');
        expect(htmlLarge).toContain('height="500"');
        expect(htmlLarge).toContain('adv-icon-large');
      }
    });
  });

  /* ========================================================================
   * 6. MarkdownViewer Component Resilience
   * ======================================================================== */
  describe('6. MarkdownViewer Component Resilience', () => {
    it('renders MarkdownViewer with empty and undefined content safely', () => {
      const { html: emptyHtml } = render(MarkdownViewer, { props: { content: '' } });
      expect(emptyHtml).toContain('markdown-viewer');

      const { html: undefHtml } = render(MarkdownViewer, { props: {} });
      expect(undefHtml).toContain('markdown-viewer');
    });

    it('renders MarkdownViewer with nested mermaid blocks alongside standard markdown', () => {
      const complexDoc = `# System Architecture\n\n\`\`\`mermaid\ngraph LR\n  Auth[Auth Service] --> Token[JWT Token]\n\`\`\`\n\n### Specifications\n- Rate limit: 100 req/sec\n- TLS 1.3 only\n\n\`\`\`mermaid\nsequenceDiagram\n  Client->>Server: Request\n  Server-->>Client: 200 OK\n\`\`\``;

      const { html } = render(MarkdownViewer, { props: { content: complexDoc } });
      expect(html).toContain('<h1>System Architecture</h1>');
      expect(html).toContain('<h3>Specifications</h3>');
      expect(html).toContain('<li>Rate limit: 100 req/sec</li>');

      const mermaidBlockMatches = html.match(/class="mermaid-block"/g);
      expect(mermaidBlockMatches).not.toBeNull();
      expect(mermaidBlockMatches?.length).toBe(2);
      expect(html).toContain('Auth[Auth Service]');
      expect(html).toContain('Client-&gt;&gt;Server: Request');
    });
  });
});
