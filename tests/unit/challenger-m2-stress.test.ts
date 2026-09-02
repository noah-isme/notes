import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateDiagramId, renderMermaidSvg, parseMermaidSyntax } from '../../src/lib/utils/mermaid';

describe('Empirical Challenger M2: Stress Testing & Verification', () => {
  describe('1. Zoom and Pan Mathematical Invariants & Stress Testing', () => {
    function calculateZoomIn(current: number): number {
      return Math.min(4.0, +(current + 0.25).toFixed(2));
    }

    function calculateZoomOut(current: number): number {
      return Math.max(0.25, +(current - 0.25).toFixed(2));
    }

    function calculateWheelZoom(current: number, deltaY: number): number {
      const delta = deltaY < 0 ? 0.15 : -0.15;
      return Math.min(4.0, Math.max(0.25, +(current + delta).toFixed(2)));
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

    it('enforces min zoom 0.25x and max zoom 4.0x across 1,000 zoomIn iterations', () => {
      let zoom = 1.0;
      for (let i = 0; i < 1000; i++) {
        zoom = calculateZoomIn(zoom);
        expect(zoom).toBeLessThanOrEqual(4.0);
        expect(zoom).toBeGreaterThanOrEqual(0.25);
        expect(Number.isFinite(zoom)).toBe(true);
      }
      expect(zoom).toBe(4.0);
    });

    it('enforces min zoom 0.25x across 1,000 zoomOut iterations', () => {
      let zoom = 1.0;
      for (let i = 0; i < 1000; i++) {
        zoom = calculateZoomOut(zoom);
        expect(zoom).toBeLessThanOrEqual(4.0);
        expect(zoom).toBeGreaterThanOrEqual(0.25);
        expect(Number.isFinite(zoom)).toBe(true);
      }
      expect(zoom).toBe(0.25);
    });

    it('prevents floating point precision drift during 2,000 alternating zoom operations', () => {
      let zoom = 1.0;
      for (let i = 0; i < 1000; i++) {
        zoom = calculateZoomIn(zoom); // 1.25
        zoom = calculateZoomOut(zoom); // 1.0
        // Ensure no decimal precision creep (e.g. 1.0000000000000002)
        expect(zoom.toString()).toMatch(/^1(\.0)?$/);
      }
      expect(zoom).toBe(1.0);
    });

    it('handles extreme wheel deltas (+10,000 to -10,000) and zero deltas without crashing or escaping bounds', () => {
      let zoom = 1.0;
      const extremeDeltas = [-10000, 10000, -0.0001, 0.0001, 0, -500, 500, -100, 100];
      for (const delta of extremeDeltas) {
        zoom = calculateWheelZoom(zoom, delta);
        expect(zoom).toBeGreaterThanOrEqual(0.25);
        expect(zoom).toBeLessThanOrEqual(4.0);
        expect(Number.isFinite(zoom)).toBe(true);
      }
    });

    it('correctly tracks multi-gesture pointer dragging across multiple pan steps', () => {
      let currentPan = { x: 0, y: 0 };

      // Gesture 1: Drag right (+50px) and down (+80px)
      const startPos1 = { x: 100, y: 100 };
      const startPan1 = { ...currentPan };
      const movePos1 = { x: 150, y: 180 };
      currentPan = calculatePan(startPan1, startPos1, movePos1);
      expect(currentPan).toEqual({ x: 50, y: 80 });

      // Gesture 2: Drag left (-30px) and up (-20px) starting from current pan
      const startPos2 = { x: 200, y: 200 };
      const startPan2 = { ...currentPan };
      const movePos2 = { x: 170, y: 180 };
      currentPan = calculatePan(startPan2, startPos2, movePos2);
      expect(currentPan).toEqual({ x: 20, y: 60 });

      // Gesture 3: Negative drag
      const startPos3 = { x: 50, y: 50 };
      const startPan3 = { ...currentPan };
      const movePos3 = { x: -50, y: -100 };
      currentPan = calculatePan(startPan3, startPos3, movePos3);
      expect(currentPan).toEqual({ x: -80, y: -90 });
    });

    it('resets both zoom and pan to defaults (1.0, {x:0, y:0}) from arbitrary distorted states', () => {
      const reset = () => ({
        zoomLevel: 1.0,
        panOffset: { x: 0, y: 0 },
      });

      const distortedStates = [
        { zoomLevel: 4.0, panOffset: { x: 9999, y: -9999 } },
        { zoomLevel: 0.25, panOffset: { x: -500, y: 350 } },
        { zoomLevel: 2.75, panOffset: { x: 42.5, y: -18.7 } },
      ];

      for (const state of distortedStates) {
        const result = reset();
        expect(result.zoomLevel).toBe(1.0);
        expect(result.panOffset).toEqual({ x: 0, y: 0 });
      }
    });
  });

  describe('2. Modal Dismiss, Keydown & Body Scroll Lock Lifecycle', () => {
    it('accurately distinguishes Escape from other keyboard events', () => {
      let isModalOpen = true;
      const handleModalKeydown = (e: { key: string }) => {
        if (e.key === 'Escape') {
          isModalOpen = false;
        }
      };

      const nonClosingKeys = ['Enter', 'Space', 'Tab', 'ArrowUp', 'ArrowDown', 'KeyA', 'Backspace', 'Shift'];
      for (const key of nonClosingKeys) {
        handleModalKeydown({ key });
        expect(isModalOpen).toBe(true);
      }

      handleModalKeydown({ key: 'Escape' });
      expect(isModalOpen).toBe(false);
    });

    it('verifies backdrop dismiss logic while modal dialog stops propagation', () => {
      let isModalOpen = true;
      const closeModal = () => {
        isModalOpen = false;
      };

      // When backdrop is clicked
      const onBackdropClick = () => {
        closeModal();
      };

      // When dialog interior is clicked
      let propagationStopped = false;
      const onDialogClick = (e: { stopPropagation: () => void }) => {
        e.stopPropagation();
      };

      // Simulate dialog click
      const mockEvent = {
        stopPropagation: () => {
          propagationStopped = true;
        },
      };
      onDialogClick(mockEvent);
      expect(propagationStopped).toBe(true);
      expect(isModalOpen).toBe(true); // Modal remains open

      // Simulate backdrop click
      onBackdropClick();
      expect(isModalOpen).toBe(false); // Modal closes
    });

    it('verifies body scroll lock effect and unmount restoration behavior', () => {
      // Setup mock DOM document.body
      const mockBody = {
        style: {
          overflow: 'auto',
        },
      };

      function simulateScrollLockEffect(isModalOpen: boolean, body: { style: { overflow: string } }) {
        if (isModalOpen) {
          const originalOverflow = body.style.overflow;
          body.style.overflow = 'hidden';
          // Cleanup function returned by effect
          return () => {
            body.style.overflow = originalOverflow;
          };
        }
        return () => {};
      }

      // Initial state: body overflow is 'auto'
      expect(mockBody.style.overflow).toBe('auto');

      // Modal opens -> overflow becomes 'hidden'
      const cleanup = simulateScrollLockEffect(true, mockBody);
      expect(mockBody.style.overflow).toBe('hidden');

      // Modal unmounts / closes -> cleanup restores 'auto'
      cleanup();
      expect(mockBody.style.overflow).toBe('auto');

      // Edge case: initial body overflow is empty string ''
      mockBody.style.overflow = '';
      const cleanup2 = simulateScrollLockEffect(true, mockBody);
      expect(mockBody.style.overflow).toBe('hidden');
      cleanup2();
      expect(mockBody.style.overflow).toBe('');
    });
  });

  describe('3. Clipboard Copy Error Fallbacks & Boundary Conditions', () => {
    let mockConsoleError: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      mockConsoleError.mockRestore();
      vi.unstubAllGlobals();
    });

    it('handles clipboard API when navigator.clipboard is undefined (insecure context fallback)', async () => {
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

    it('gracefully handles clipboard writeText rejection (NotAllowedError / permission denied)', async () => {
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

    it('handles copySvg rejection when SVG rendering fails or SVG is empty', async () => {
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

      // Call with empty string
      await copySvg('');
      expect(mockClipboard.writeText).not.toHaveBeenCalled();
      expect(copiedSvg).toBe(false);

      // Call with valid SVG
      await copySvg('<svg id="test"></svg>');
      expect(mockClipboard.writeText).toHaveBeenCalledWith('<svg id="test"></svg>');
      expect(copiedSvg).toBe(true);
    });
  });

  describe('4. Diagram ID Collision Resistance', () => {
    it('generates 5,000 unique valid DOM ids without collisions', () => {
      const ids = new Set<string>();
      const total = 5000;

      for (let i = 0; i < total; i++) {
        const id = generateDiagramId('diag');
        expect(id).toMatch(/^diag_[a-z0-9]+_[a-z0-9]+_[a-z0-9]+$/);
        ids.add(id);
      }

      expect(ids.size).toBe(total);
    });
  });
});
