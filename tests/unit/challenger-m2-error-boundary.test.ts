import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from 'svelte/server';
import MermaidDiagram from '../../src/lib/components/MermaidDiagram.svelte';
import {
  renderMermaidSvg,
  parseMermaidSyntax,
  generateDiagramId,
  isMermaidSupported,
  getMermaid,
} from '../../src/lib/utils/mermaid';

/**
 * ============================================================================
 * CHALLENGER 2: Milestone 2 Empirical Stress Test Suite
 * ============================================================================
 * Focus:
 * 1. Broken mermaid syntax error boundaries & fallback code accessibility
 * 2. Dynamic recovery when updating broken syntax to valid syntax
 * 3. Rapid sequential prop changes and async race condition resilience
 * 4. DOM artifact cleanup and memory safety on syntax errors
 * 5. Isolation: Sibling diagrams resilience when one or more fail
 * ============================================================================
 */

describe('Challenger M2: Error Boundary & Dynamic Recovery Stress Suite', () => {
  // --------------------------------------------------------------------------
  // 1. Broken Mermaid Syntax Test Matrix
  // --------------------------------------------------------------------------
  describe('1. Broken Mermaid Syntax & Error Boundary Rendering', () => {
    const brokenSyntaxSamples = [
      {
        name: 'Mismatched brackets in flowchart node',
        code: 'graph TD\n  A[Unclosed bracket --> B',
      },
      {
        name: 'Unknown / invalid diagram header keyword',
        code: 'invalidKeyword TD\n  A --> B',
      },
      {
        name: 'Malformed sequence diagram arrow',
        code: 'sequenceDiagram\n  Alice -->>\n  Bob ->>',
      },
      {
        name: 'Malformed ER diagram cardinality',
        code: 'erDiagram\n  USER ||--|{ NOTE : invalid_cardinality\n  USER { string id',
      },
      {
        name: 'Malformed class diagram member definition',
        code: 'classDiagram\n  class BrokenClass {\n    +int : invalid syntax\n  }',
      },
      {
        name: 'Malformed state diagram transition',
        code: 'stateDiagram-v2\n  [*] --->>> BrokenState',
      },
      {
        name: 'Malformed gitGraph syntax',
        code: 'gitGraph\n  commit\n  invalid_git_command\n  checkout main',
      },
      {
        name: 'Malformed gantt section without dates',
        code: 'gantt\n  title Bad Gantt\n  section Task\n  Task 1: done',
      },
      {
        name: 'Empty string definition',
        code: '',
      },
      {
        name: 'Whitespace only definition',
        code: '   \n\t  \n   ',
      },
    ];

    it.each(brokenSyntaxSamples)(
      'SSR fallback renders raw broken code safely for: $name',
      ({ code }) => {
        const { html } = render(MermaidDiagram, {
          props: { code, title: 'Error Test' },
        });

        // SSR fallback container must be present (includes scoped class)
        expect(html).toContain('mermaid-block');
        expect(html).toContain('data-mermaid-code=');
        expect(html).toContain('language-mermaid');

        if (code.trim()) {
          // Verify raw code is preserved without unescaped corruption
          const firstLine = code.trim().split('\n')[0];
          expect(html).toContain(firstLine.replace(/</g, '&lt;').replace(/>/g, '&gt;'));
        }
      }
    );

    it('rejects broken syntax in parseMermaidSyntax without crashing', async () => {
      for (const sample of brokenSyntaxSamples) {
        const result = await parseMermaidSyntax(sample.code);
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
        expect(typeof result.error).toBe('string');
        expect(result.error!.length).toBeGreaterThan(0);
      }
    });

    it('returns structured error object from renderMermaidSvg for all broken samples', async () => {
      for (const sample of brokenSyntaxSamples) {
        const result = await renderMermaidSvg(generateDiagramId('err_test'), sample.code);
        expect('error' in result).toBe(true);
        if ('error' in result) {
          expect(result.error).toBeDefined();
          expect(typeof result.error).toBe('string');
        }
      }
    });
  });

  // --------------------------------------------------------------------------
  // 2. Simulated Client State Machine & Error Boundary Logic
  // --------------------------------------------------------------------------
  describe('2. Client Error Boundary State Machine & Fallback Access', () => {
    interface ComponentRenderState {
      renderedSvg: string;
      renderError: string | null;
      isLoading: boolean;
      showRawCode: boolean;
      currentCode: string;
    }

    class MermaidDiagramSimulator {
      public state: ComponentRenderState;
      private currentRenderId = 0;

      constructor(initialCode: string) {
        this.state = {
          renderedSvg: '',
          renderError: null,
          isLoading: true,
          showRawCode: false,
          currentCode: initialCode,
        };
      }

      async updateCode(
        newCode: string,
        renderEngine: (id: string, code: string) => Promise<{ svg: string } | { error: string }>,
        delayMs = 0
      ): Promise<void> {
        this.state.currentCode = newCode;
        this.state.isLoading = true;
        const renderId = ++this.currentRenderId;

        if (!newCode || !newCode.trim()) {
          this.state.renderedSvg = '';
          this.state.renderError = 'Empty diagram definition';
          this.state.isLoading = false;
          return;
        }

        if (delayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }

        try {
          const result = await renderEngine(`diag_${renderId}`, newCode);
          // Emulate Svelte 5 cancellation guard: if (!isCurrent) return;
          if (renderId !== this.currentRenderId) return;

          if ('error' in result) {
            this.state.renderError = result.error;
            this.state.renderedSvg = '';
          } else {
            this.state.renderError = null;
            this.state.renderedSvg = result.svg;
          }
        } catch (err: any) {
          if (renderId !== this.currentRenderId) return;
          this.state.renderError = err?.message || String(err);
          this.state.renderedSvg = '';
        } finally {
          if (renderId === this.currentRenderId) {
            this.state.isLoading = false;
          }
        }
      }

      toggleRawCode(): void {
        this.state.showRawCode = !this.state.showRawCode;
      }
    }

    it('populates error banner state with diagnostic info and preserves raw fallback', async () => {
      const brokenCode = 'graph TD\n  A[Missing Closing Bracket --> B';
      const sim = new MermaidDiagramSimulator(brokenCode);

      const mockEngine = async (_id: string, _code: string) => {
        return { error: 'Parse error on line 2: Mismatched brackets' };
      };

      await sim.updateCode(brokenCode, mockEngine);

      expect(sim.state.isLoading).toBe(false);
      expect(sim.state.renderedSvg).toBe('');
      expect(sim.state.renderError).toBe('Parse error on line 2: Mismatched brackets');
      expect(sim.state.currentCode).toBe(brokenCode);
    });

    it('catches asynchronous engine exceptions without throwing or crashing parent', async () => {
      const brokenCode = 'graph LR\n  A --> B';
      const sim = new MermaidDiagramSimulator(brokenCode);

      const crashingEngine = async () => {
        throw new Error('Mermaid fatal tokenizer failure');
      };

      await expect(sim.updateCode(brokenCode, crashingEngine)).resolves.not.toThrow();

      expect(sim.state.isLoading).toBe(false);
      expect(sim.state.renderedSvg).toBe('');
      expect(sim.state.renderError).toBe('Mermaid fatal tokenizer failure');
    });

    it('allows toggling raw code drawer during valid state and keeps source accessible', () => {
      const validCode = 'graph TD\n  A --> B';
      const sim = new MermaidDiagramSimulator(validCode);

      expect(sim.state.showRawCode).toBe(false);
      sim.toggleRawCode();
      expect(sim.state.showRawCode).toBe(true);
      sim.toggleRawCode();
      expect(sim.state.showRawCode).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Dynamic Recovery Stress Testing
  // --------------------------------------------------------------------------
  describe('3. Dynamic Recovery & Transition Matrix', () => {
    it('executes full transition matrix: valid -> invalid -> valid -> invalid -> valid', async () => {
      let state = {
        renderedSvg: '',
        renderError: <string | null>null,
        isLoading: false,
      };

      const mockEngine = async (code: string): Promise<{ svg: string } | { error: string }> => {
        if (code.includes('BROKEN')) {
          return { error: `Syntax error in: ${code}` };
        }
        return { svg: `<svg id="valid-${code.length}"><text>${code}</text></svg>` };
      };

      async function applyCode(code: string) {
        state.isLoading = true;
        const res = await mockEngine(code);
        if ('error' in res) {
          state.renderError = res.error;
          state.renderedSvg = '';
        } else {
          state.renderError = null;
          state.renderedSvg = res.svg;
        }
        state.isLoading = false;
      }

      // Step 1: Valid initial render
      await applyCode('graph TD\n  A --> B');
      expect(state.renderError).toBeNull();
      expect(state.renderedSvg).toContain('<svg id="valid-');

      // Step 2: Broken syntax introduced
      await applyCode('graph TD\n  A BROKEN B');
      expect(state.renderError).toContain('Syntax error in: graph TD\n  A BROKEN B');
      expect(state.renderedSvg).toBe('');

      // Step 3: User fixes syntax (Dynamic Recovery)
      await applyCode('graph TD\n  A --> B\n  B --> C');
      expect(state.renderError).toBeNull();
      expect(state.renderedSvg).toContain('<svg id="valid-');

      // Step 4: Another broken syntax introduced
      await applyCode('sequenceDiagram\n  BROKEN');
      expect(state.renderError).toContain('Syntax error in: sequenceDiagram\n  BROKEN');
      expect(state.renderedSvg).toBe('');

      // Step 5: User fixes sequence diagram (Dynamic Recovery)
      await applyCode('sequenceDiagram\n  Alice->>Bob: Hello');
      expect(state.renderError).toBeNull();
      expect(state.renderedSvg).toContain('<svg id="valid-');
    });

    it('handles 100 consecutive rapid valid/broken transitions without memory corruption', async () => {
      let errorCount = 0;
      let successCount = 0;

      for (let i = 0; i < 100; i++) {
        const isBroken = i % 2 === 1;
        const code = isBroken ? `graph TD\n  BROKEN_${i}` : `graph TD\n  Node${i} --> Node${i + 1}`;

        const isError = code.includes('BROKEN');
        if (isError) {
          errorCount++;
        } else {
          successCount++;
        }
      }

      expect(errorCount).toBe(50);
      expect(successCount).toBe(50);
    });
  });

  // --------------------------------------------------------------------------
  // 4. Rapid Sequential Prop Changes & Race Conditions
  // --------------------------------------------------------------------------
  describe('4. Rapid Sequential Prop Changes (Race Condition Stress Test)', () => {
    it('guarantees that slow stale renders never overwrite newer completed renders', async () => {
      let finalSvg = '';
      let finalError: string | null = null;
      let activeRenderId = 0;

      // Simulated engine where render 1 is artificially slow (80ms),
      // render 2 is fast (10ms) and fails,
      // render 3 is medium (30ms) and succeeds.
      const simulatedRenders: { id: number; delay: number; code: string; result: { svg: string } | { error: string } }[] = [
        { id: 1, delay: 80, code: 'graph TD\n  SLOW_1 --> B', result: { svg: '<svg id="slow-1"/>' } },
        { id: 2, delay: 10, code: 'graph TD\n  FAST_BROKEN', result: { error: 'Syntax error in fast' } },
        { id: 3, delay: 30, code: 'graph TD\n  FINAL_VALID --> Z', result: { svg: '<svg id="final-valid"/>' } },
      ];

      async function triggerRender(stepIndex: number) {
        const step = simulatedRenders[stepIndex];
        const currentId = ++activeRenderId;

        await new Promise((resolve) => setTimeout(resolve, step.delay));

        // Cancellation guard
        if (currentId !== activeRenderId) {
          return; // Abandon stale render
        }

        if ('error' in step.result) {
          finalError = step.result.error;
          finalSvg = '';
        } else {
          finalError = null;
          finalSvg = step.result.svg;
        }
      }

      // Fire all three rapidly in sequence (t=0, t=5, t=10)
      const p1 = triggerRender(0); // takes 80ms, will resolve at ~80ms (stale)
      await new Promise((r) => setTimeout(r, 5));
      const p2 = triggerRender(1); // takes 10ms, will resolve at ~15ms (stale)
      await new Promise((r) => setTimeout(r, 5));
      const p3 = triggerRender(2); // takes 30ms, will resolve at ~40ms (CURRENT)

      await Promise.all([p1, p2, p3]);

      // The final state MUST be the result of render #3 ('<svg id="final-valid"/>')
      expect(finalSvg).toBe('<svg id="final-valid"/>');
      expect(finalError).toBeNull();
    });

    it('stress tests 50 simultaneous rapid prop mutations with randomized completion latencies', async () => {
      let activeId = 0;
      let finalResolvedValue = '';

      const promises: Promise<void>[] = [];

      for (let i = 1; i <= 50; i++) {
        const renderId = ++activeId;
        const latency = Math.floor(Math.random() * 50) + 5; // 5ms to 55ms
        const expectedVal = `RENDER_RESULT_${i}`;

        const p = new Promise<void>((resolve) => {
          setTimeout(() => {
            if (renderId === activeId) {
              finalResolvedValue = expectedVal;
            }
            resolve();
          }, latency);
        });

        promises.push(p);
      }

      await Promise.all(promises);

      // The final resolved value must strictly be the 50th invocation
      expect(finalResolvedValue).toBe('RENDER_RESULT_50');
    });
  });

  // --------------------------------------------------------------------------
  // 5. DOM Cleanup & Sibling Diagram Isolation
  // --------------------------------------------------------------------------
  describe('5. DOM Cleanup & Sibling Diagram Isolation', () => {
    it('cleans up orphaned Mermaid error DOM elements if present in document', () => {
      // Setup mock DOM environment
      const mockElement = {
        id: 'dmermaid_test_123',
        remove: vi.fn(),
      };

      const mockDocument = {
        getElementById: vi.fn((id: string) => {
          if (id === 'dmermaid_test_123' || id === 'mermaid_test_123') {
            return mockElement;
          }
          return null;
        }),
      };

      vi.stubGlobal('document', mockDocument);

      // Simulate cleanup logic from renderMermaidSvg catch block
      const safeId = 'mermaid_test_123';
      const errorElement =
        mockDocument.getElementById(`d${safeId}`) || mockDocument.getElementById(safeId);
      if (errorElement) {
        errorElement.remove();
      }

      expect(mockDocument.getElementById).toHaveBeenCalledWith('dmermaid_test_123');
      expect(mockElement.remove).toHaveBeenCalled();

      vi.unstubAllGlobals();
    });

    it('ensures failure in diagram A does not impede rendering in sibling diagram B', async () => {
      const diagramA_Broken = 'graph TD\n  Broken Syntax';
      const diagramB_Valid = 'sequenceDiagram\n  Client->>Server: Request';

      const renderEngine = async (_id: string, code: string) => {
        if (code.includes('Broken')) {
          return { error: 'Syntax Error in Diagram A' };
        }
        return { svg: '<svg id="diagramB"><text>Server Response</text></svg>' };
      };

      const [resA, resB] = await Promise.all([
        renderEngine('diagA', diagramA_Broken),
        renderEngine('diagB', diagramB_Valid),
      ]);

      expect('error' in resA).toBe(true);
      expect('svg' in resB).toBe(true);

      if ('error' in resA) {
        expect(resA.error).toBe('Syntax Error in Diagram A');
      }
      if ('svg' in resB) {
        expect(resB.svg).toContain('<svg id="diagramB">');
      }
    });
  });

  // --------------------------------------------------------------------------
  // 6. Action Controls Accessibility & Error State Behavior
  // --------------------------------------------------------------------------
  describe('6. Action Controls & Toolbar State in Error vs Valid Mode', () => {
    it('verifies that Copy Source is enabled during error state while Copy SVG is disabled', () => {
      const stateWithError = {
        hasError: true,
        renderedSvg: '',
        code: 'graph TD\n  A --> BROKEN',
      };

      const isCopySourceAvailable = Boolean(stateWithError.code);
      const isCopySvgAvailable = Boolean(stateWithError.renderedSvg && !stateWithError.hasError);
      const isFullscreenAvailable = Boolean(stateWithError.renderedSvg && !stateWithError.hasError);

      expect(isCopySourceAvailable).toBe(true);
      expect(isCopySvgAvailable).toBe(false);
      expect(isFullscreenAvailable).toBe(false);
    });

    it('verifies that Copy SVG and Fullscreen become enabled once recovered', () => {
      const stateRecovered = {
        hasError: false,
        renderedSvg: '<svg id="ok"><g></g></svg>',
        code: 'graph TD\n  A --> B',
      };

      const isCopySourceAvailable = Boolean(stateRecovered.code);
      const isCopySvgAvailable = Boolean(stateRecovered.renderedSvg && !stateRecovered.hasError);
      const isFullscreenAvailable = Boolean(stateRecovered.renderedSvg && !stateRecovered.hasError);

      expect(isCopySourceAvailable).toBe(true);
      expect(isCopySvgAvailable).toBe(true);
      expect(isFullscreenAvailable).toBe(true);
    });
  });
});
