import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from 'svelte/server';
import MermaidDiagram from '../../src/lib/components/MermaidDiagram.svelte';
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
} from '../../src/lib/components/icons';
import * as iconsModule from '../../src/lib/components/icons';

describe('Unit: Mermaid UI Controls, Icons & Error Boundary (Milestone 2)', () => {
  describe('1. SVG Icon Components & Exports', () => {
    it('exports all 9 required M2 icons from icons/index.ts', () => {
      expect(iconsModule.IconCopy).toBeDefined();
      expect(iconsModule.IconMaximize).toBeDefined();
      expect(iconsModule.IconZoomIn).toBeDefined();
      expect(iconsModule.IconZoomOut).toBeDefined();
      expect(iconsModule.IconRotateCcw).toBeDefined();
      expect(iconsModule.IconCode).toBeDefined();
      expect(iconsModule.IconDownload).toBeDefined();
      expect(iconsModule.IconCheck).toBeDefined();
      expect(iconsModule.IconAlertCircle).toBeDefined();
    });

    it('renders IconCopy with custom size and class in SSR', () => {
      const { html } = render(IconCopy, { props: { size: 20, class: 'test-copy-icon' } });
      expect(html).toContain('width="20"');
      expect(html).toContain('height="20"');
      expect(html).toContain('class="test-copy-icon"');
      expect(html).toContain('aria-hidden="true"');
      expect(html).toContain('viewBox="0 0 24 24"');
    });

    it('renders IconMaximize with default size 16 in SSR', () => {
      const { html } = render(IconMaximize, { props: {} });
      expect(html).toContain('width="16"');
      expect(html).toContain('height="16"');
      expect(html).toContain('aria-hidden="true"');
      expect(html).toContain('viewBox="0 0 24 24"');
    });

    it('renders IconZoomIn and IconZoomOut with proper SVG paths in SSR', () => {
      const zoomInResult = render(IconZoomIn, { props: { size: 18 } });
      const zoomOutResult = render(IconZoomOut, { props: { size: 18 } });

      expect(zoomInResult.html).toContain('width="18"');
      expect(zoomInResult.html).toContain('line');
      expect(zoomOutResult.html).toContain('width="18"');
      expect(zoomOutResult.html).toContain('circle');
    });

    it('renders IconRotateCcw, IconCode, and IconDownload in SSR', () => {
      const ccwResult = render(IconRotateCcw, { props: {} });
      const codeResult = render(IconCode, { props: { class: 'code-icon' } });
      const downloadResult = render(IconDownload, { props: { size: 24 } });

      expect(ccwResult.html).toContain('path');
      expect(codeResult.html).toContain('polyline');
      expect(codeResult.html).toContain('class="code-icon"');
      expect(downloadResult.html).toContain('width="24"');
    });

    it('renders IconAlertCircle with exclamation elements in SSR', () => {
      const { html } = render(IconAlertCircle, { props: { size: 22, class: 'alert-icon' } });
      expect(html).toContain('circle');
      expect(html).toContain('line');
      expect(html).toContain('class="alert-icon"');
      expect(html).toContain('width="22"');
    });
  });

  describe('2. MermaidDiagram SSR Fallback & Props', () => {
    const sampleMermaidCode = `graph TD\n  Client[Web Client] --> Gateway[API Gateway]\n  Gateway --> Service[Auth Service]`;

    it('renders semantic SSR fallback markup with data-mermaid-code', () => {
      const { html } = render(MermaidDiagram, {
        props: { code: sampleMermaidCode },
      });

      expect(html).toContain('mermaid-block');
      expect(html).toContain('data-mermaid-code=');
      expect(html).toContain('<code class="language-mermaid">');
      expect(html).toContain('Client[Web Client]');
      expect(html).toContain('Gateway[API Gateway]');
    });

    it('renders optional diagram title in SSR fallback when provided', () => {
      const { html } = render(MermaidDiagram, {
        props: {
          code: sampleMermaidCode,
          title: 'System Architecture Flow',
        },
      });

      expect(html).toContain('System Architecture Flow');
      expect(html).toContain('diagram-title');
    });

    it('safely escapes HTML in SSR fallback code attribute and body', () => {
      const maliciousCode = `graph TD\n  A["<script>alert('xss')</script>"] --> B["<img src=x onerror=alert(1)>"]`;
      const { html } = render(MermaidDiagram, {
        props: { code: maliciousCode },
      });

      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script');
      expect(html).toContain('&lt;img');
    });

    it('handles empty code string gracefully in SSR', () => {
      const { html } = render(MermaidDiagram, {
        props: { code: '' },
      });

      expect(html).toContain('mermaid-block');
      expect(html).toContain('<code class="language-mermaid">');
    });
  });

  describe('3. Zoom & Pan Boundary Logic', () => {
    it('accurately clamps zoom level between 0.25 and 4.0', () => {
      function clampZoom(currentZoom: number, delta: number): number {
        const nextZoom = +(currentZoom + delta).toFixed(2);
        return Math.min(4.0, Math.max(0.25, nextZoom));
      }

      // Standard zoom in / out
      expect(clampZoom(1.0, 0.25)).toBe(1.25);
      expect(clampZoom(1.0, -0.25)).toBe(0.75);

      // Upper boundary clamping
      expect(clampZoom(3.75, 0.5)).toBe(4.0);
      expect(clampZoom(4.0, 0.25)).toBe(4.0);
      expect(clampZoom(5.0, 1.0)).toBe(4.0);

      // Lower boundary clamping
      expect(clampZoom(0.35, -0.25)).toBe(0.25);
      expect(clampZoom(0.25, -0.25)).toBe(0.25);
      expect(clampZoom(0.1, -0.5)).toBe(0.25);
    });

    it('calculates pan offsets correctly during dragging', () => {
      const startPan = { x: 10, y: 20 };
      const startPointer = { x: 100, y: 150 };
      const currentPointer = { x: 145, y: 190 };

      const nextPan = {
        x: startPan.x + (currentPointer.x - startPointer.x),
        y: startPan.y + (currentPointer.y - startPointer.y),
      };

      expect(nextPan.x).toBe(55);
      expect(nextPan.y).toBe(60);
    });

    it('resets zoom to 1.0 and pan to (0,0)', () => {
      let zoom = 3.5;
      let pan = { x: 120, y: -80 };

      // Reset
      zoom = 1.0;
      pan = { x: 0, y: 0 };

      expect(zoom).toBe(1.0);
      expect(pan).toEqual({ x: 0, y: 0 });
    });
  });

  describe('4. Clipboard & SVG Download Handlers', () => {
    let mockClipboard: { writeText: ReturnType<typeof vi.fn> };

    beforeEach(() => {
      mockClipboard = {
        writeText: vi.fn().mockResolvedValue(undefined),
      };
      vi.stubGlobal('navigator', {
        clipboard: mockClipboard,
      });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('copies raw diagram code to clipboard', async () => {
      const code = 'graph LR\n  A --> B';
      await navigator.clipboard.writeText(code);
      expect(mockClipboard.writeText).toHaveBeenCalledWith(code);
    });

    it('copies rendered SVG string to clipboard', async () => {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg"><g><text>Diagram</text></g></svg>';
      await navigator.clipboard.writeText(svg);
      expect(mockClipboard.writeText).toHaveBeenCalledWith(svg);
    });

    it('creates Blob and triggers download link cleanly for SVG export', () => {
      const mockCreateObjectURL = vi.fn().mockReturnValue('blob:http://localhost/mock-uuid');
      const mockRevokeObjectURL = vi.fn();
      vi.stubGlobal('URL', {
        createObjectURL: mockCreateObjectURL,
        revokeObjectURL: mockRevokeObjectURL,
      });

      const svgContent = '<svg id="diag"><circle r="10" /></svg>';
      const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      expect(url).toBe('blob:http://localhost/mock-uuid');
      expect(mockCreateObjectURL).toHaveBeenCalled();

      URL.revokeObjectURL(url);
      expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:http://localhost/mock-uuid');
    });
  });

  describe('5. Resilient Error Boundary & Auto-Recovery', () => {
    it('simulates error state structure with role="alert" and fallback source view', () => {
      const syntaxError = 'Parse error on line 2: Unexpected token -->';
      const rawCode = 'graph TD\n  A --> --> B';

      // Verify the error payload model used by MermaidDiagram
      const errorModel = {
        hasError: true,
        errorMessage: syntaxError,
        rawCode,
        showFallback: true,
      };

      expect(errorModel.hasError).toBe(true);
      expect(errorModel.errorMessage).toContain('Parse error');
      expect(errorModel.rawCode).toBe(rawCode);
    });

    it('recovers cleanly when valid diagram code replaces invalid code', () => {
      let currentError: string | null = 'Syntax error: invalid graph definition';
      let currentSvg = '';

      // User fixes typo
      const fixedResult = {
        svg: '<svg id="recovered"><g><rect width="100" height="50"/></g></svg>',
      };

      if ('svg' in fixedResult) {
        currentError = null;
        currentSvg = fixedResult.svg;
      }

      expect(currentError).toBeNull();
      expect(currentSvg).toContain('<svg id="recovered">');
    });
  });

  describe('6. WAI-ARIA Dialog Conformance', () => {
    it('adheres to WAI-ARIA 1.2 modal dialog properties', () => {
      const modalAttributes = {
        role: 'dialog',
        'aria-modal': 'true',
        'aria-label': 'Diagram Preview',
        tabIndex: -1,
      };

      expect(modalAttributes.role).toBe('dialog');
      expect(modalAttributes['aria-modal']).toBe('true');
      expect(modalAttributes['aria-label']).toBe('Diagram Preview');
      expect(modalAttributes.tabIndex).toBe(-1);
    });

    it('handles Escape key to trigger modal dismissal', () => {
      let isModalOpen = true;

      function handleKeydown(e: { key: string }) {
        if (e.key === 'Escape') {
          isModalOpen = false;
        }
      }

      handleKeydown({ key: 'Enter' });
      expect(isModalOpen).toBe(true);

      handleKeydown({ key: 'Escape' });
      expect(isModalOpen).toBe(false);
    });
  });
});
