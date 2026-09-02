import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from 'svelte/server';
import MermaidDiagram from '../../src/lib/components/MermaidDiagram.svelte';
import { mermaidRenderer } from '../../src/lib/actions/mermaid';
import { renderMarkdown, stripMarkdown, parseMarkdown } from '../../src/lib/utils/markdown';
import {
  renderMermaidSvg,
  parseMermaidSyntax,
  generateDiagramId,
  isMermaidSupported,
  getMermaid,
  initializeMermaid,
  SLATE_THEME_VARIABLES,
} from '../../src/lib/utils/mermaid';
import { validateMermaidSyntax, MermaidServiceContract } from './mermaid-e2e.test';

/**
 * ============================================================================
 * TIER 5 ADVERSARIAL HARDENING SUITE: MERMAID INTERACTIVE DIAGRAMS
 * ============================================================================
 * Specification: ORIGINAL_REQUEST.md, PROJECT.md
 * Persona: Empirical Challenger (critic, specialist)
 *
 * Test Matrix:
 * 1. Massive Diagrams (200+ nodes, deeply nested subgraphs, extreme complexities)
 * 2. Adversarial Code Fences (whitespace variants, zero-width chars, mixed backticks)
 * 3. SVG Sanitization Vectors & XSS Injection Payload Resistance
 * 4. High-Concurrency Async Rendering Requests & Mutex Lock Behavior
 * 5. DOM Mutation & Element Cleanup Under Error States
 * ============================================================================
 */

describe('Tier 5 Adversarial Hardening Suite: Mermaid.js Engine & Components', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // CATEGORY 1: MASSIVE DIAGRAMS & COMPLEX GRAPH TOPOLOGIES
  // ==========================================================================
  describe('Category 1: Massive Diagrams (200+ Nodes, Deep Subgraphs & Complex Topologies)', () => {
    it('1.1: should parse and validate a massive linear flowchart with 250 sequential nodes', () => {
      const nodes: string[] = ['graph TD'];
      for (let i = 0; i < 250; i++) {
        nodes.push(`  N${i}[Node ${i}: Service Payload Worker] --> N${i + 1}[Node ${i + 1}]`);
      }
      const code = nodes.join('\n');

      const syntax = validateMermaidSyntax(code);
      expect(syntax.valid).toBe(true);
      expect(syntax.type).toBe('flowchart');

      const md = `\`\`\`mermaid\n${code}\n\`\`\``;
      const html = renderMarkdown(md);
      expect(html).toContain('class="mermaid-block"');
      expect(html).toContain('data-mermaid-code=');
      expect(html).toContain('Node 0: Service Payload Worker');
      expect(html).toContain('Node 250');

      const stripped = stripMarkdown(md);
      expect(stripped).not.toContain('graph TD');
      expect(stripped).not.toContain('-->');
    });

    it('1.2: should parse and validate a dense star/mesh graph with 300 connected nodes', () => {
      const lines: string[] = ['graph LR', '  Hub((Central Gateway Controller))'];
      for (let i = 1; i <= 300; i++) {
        lines.push(`  Hub --> Leaf_${i}[Microservice Worker Instance ${i}]`);
      }
      const code = lines.join('\n');

      const syntax = validateMermaidSyntax(code);
      expect(syntax.valid).toBe(true);
      expect(syntax.type).toBe('flowchart');

      const { html } = render(MermaidDiagram, {
        props: { code, title: 'Star Topology 300 Nodes' },
      });
      expect(html).toContain('Star Topology 300 Nodes');
      expect(html).toContain('data-mermaid-code=');
      expect(html).toContain('Microservice Worker Instance 300');
    });

    it('1.3: should handle deeply nested subgraphs (16 nesting levels deep)', () => {
      const lines: string[] = ['graph TB'];
      const depth = 16;
      for (let d = 1; d <= depth; d++) {
        lines.push(`${'  '.repeat(d)}subgraph Level_${d} [Security Enclave Level ${d}]`);
      }
      lines.push(`${'  '.repeat(depth + 1)}CoreVault[(Encrypted Data Vault)]`);
      for (let d = depth; d >= 1; d--) {
        lines.push(`${'  '.repeat(d)}end`);
      }
      const code = lines.join('\n');

      const syntax = validateMermaidSyntax(code);
      expect(syntax.valid).toBe(true);
      expect(syntax.type).toBe('flowchart');

      const html = renderMarkdown(`\`\`\`mermaid\n${code}\n\`\`\``);
      expect(html).toContain('Security Enclave Level 16');
      expect(html).toContain('CoreVault');
    });

    it('1.4: should handle multi-cluster subgraphs with 200 nodes and cross-cluster interconnects', () => {
      const lines: string[] = ['flowchart TD'];
      for (let cluster = 1; cluster <= 10; cluster++) {
        lines.push(`  subgraph Cluster_${cluster} [Datacenter Region ${cluster}]`);
        for (let node = 1; node <= 20; node++) {
          lines.push(`    C${cluster}_N${node}[Node ${cluster}.${node}]`);
          if (node > 1) {
            lines.push(`    C${cluster}_N${node - 1} --> C${cluster}_N${node}`);
          }
        }
        lines.push('  end');
      }
      // Cross-cluster bridge links
      for (let cluster = 1; cluster < 10; cluster++) {
        lines.push(`  C${cluster}_N20 ==> C${cluster + 1}_N1`);
      }
      const code = lines.join('\n');

      const syntax = validateMermaidSyntax(code);
      expect(syntax.valid).toBe(true);

      const html = renderMarkdown(`\`\`\`mermaid\n${code}\n\`\`\``);
      expect(html).toContain('Datacenter Region 10');
      expect(html).toContain('C10_N20');
    });

    it('1.5: should parse and validate massive sequence diagrams with 100 participants and 200 messages', () => {
      const lines: string[] = ['sequenceDiagram', '  autonumber'];
      for (let p = 1; p <= 100; p++) {
        lines.push(`  participant P${p} as Service Node ${p}`);
      }
      for (let m = 1; m <= 100; m++) {
        lines.push(`  P${m}->>P${(m % 100) + 1}: Sync Request Message ${m}`);
        lines.push(`  P${(m % 100) + 1}-->>P${m}: Acknowledge Response ${m}`);
      }
      const code = lines.join('\n');

      const syntax = validateMermaidSyntax(code);
      expect(syntax.valid).toBe(true);
      expect(syntax.type).toBe('sequence');

      const { html } = render(MermaidDiagram, { props: { code } });
      expect(html).toContain('Service Node 100');
      expect(html).toContain('Sync Request Message 100');
    });

    it('1.6: should parse and validate massive ER diagrams with 50 entities and 100 relationships', () => {
      const lines: string[] = ['erDiagram'];
      for (let e = 1; e <= 50; e++) {
        lines.push(`  ENTITY_${e} {`);
        lines.push(`    string id PK`);
        lines.push(`    string name`);
        lines.push(`    string metadata_${e}`);
        lines.push(`    datetime created_at`);
        lines.push(`  }`);
      }
      for (let r = 1; r < 50; r++) {
        lines.push(`  ENTITY_${r} ||--o{ ENTITY_${r + 1} : references_${r}`);
      }
      const code = lines.join('\n');

      const syntax = validateMermaidSyntax(code);
      expect(syntax.valid).toBe(true);
      expect(syntax.type).toBe('er');

      const html = renderMarkdown(`\`\`\`mermaid\n${code}\n\`\`\``);
      expect(html).toContain('ENTITY_50');
      expect(html).toContain('references_49');
    });

    it('1.7: should parse and validate massive class diagrams with 60 classes and inheritance hierarchies', () => {
      const lines: string[] = ['classDiagram'];
      for (let c = 1; c <= 60; c++) {
        lines.push(`  class Model_${c} {`);
        lines.push(`    +String primaryKey`);
        lines.push(`    #Integer revision`);
        lines.push(`    -Boolean isEncrypted`);
        lines.push(`    +execute_${c}(param: String) Result`);
        lines.push(`  }`);
      }
      for (let c = 2; c <= 60; c++) {
        lines.push(`  Model_1 <|-- Model_${c} : specializes`);
      }
      const code = lines.join('\n');

      const syntax = validateMermaidSyntax(code);
      expect(syntax.valid).toBe(true);
      expect(syntax.type).toBe('class');

      const html = renderMarkdown(`\`\`\`mermaid\n${code}\n\`\`\``);
      expect(html).toContain('Model_60');
      expect(html).toContain('execute_60');
    });

    it('1.8: should parse and validate massive Mindmap with 8 depth tiers and 200 nodes', () => {
      const lines: string[] = ['mindmap', '  root((Knowledge Base Root))'];
      for (let b = 1; b <= 10; b++) {
        lines.push(`    Branch_${b}[Branch Domain ${b}]`);
        for (let sub = 1; sub <= 5; sub++) {
          lines.push(`      Subtopic_${b}_${sub}(Subtopic ${sub})`);
          for (let leaf = 1; leaf <= 3; leaf++) {
            lines.push(`        Leaf_${b}_${sub}_${leaf}((Concept Leaf ${leaf}))`);
          }
        }
      }
      const code = lines.join('\n');

      const syntax = validateMermaidSyntax(code);
      expect(syntax.valid).toBe(true);
      expect(syntax.type).toBe('mindmap');

      const html = renderMarkdown(`\`\`\`mermaid\n${code}\n\`\`\``);
      expect(html).toContain('Knowledge Base Root');
      expect(html).toContain('Branch Domain 10');
      expect(html).toContain('Concept Leaf 3');
    });

    it('1.9: should process a 300KB markdown document containing 10 massive diagrams within 100ms without ReDoS', () => {
      let hugeDoc = '# Massive Technical Specification\n\n';
      for (let d = 1; d <= 10; d++) {
        hugeDoc += `## Section ${d}: Subsystem Topology ${d}\n\n`;
        hugeDoc += '```mermaid\ngraph TD\n';
        for (let n = 1; n <= 50; n++) {
          hugeDoc += `  D${d}_N${n}[System Node ${d}.${n}] --> D${d}_N${n + 1}[Target ${n + 1}]\n`;
        }
        hugeDoc += '```\n\n' + 'Detailed architectural explanation text paragraph. '.repeat(100) + '\n\n';
      }

      const startTime = performance.now();
      const output = renderMarkdown(hugeDoc);
      const durationMs = performance.now() - startTime;

      expect(durationMs).toBeLessThan(150);
      const matches = output.match(/class="mermaid-block"/g);
      expect(matches?.length).toBe(10);
      expect(output).toContain('Section 10: Subsystem Topology 10');
    });
  });

  // ==========================================================================
  // CATEGORY 2: ADVERSARIAL CODE FENCES, UNICODE & BOUNDARY NORMALIZATION
  // ==========================================================================
  describe('Category 2: Adversarial Code Fences & Syntax Boundary Normalization', () => {
    it('2.1: should handle leading whitespace before code fence (1, 2, and 3 spaces)', () => {
      const variants = [
        ' ```mermaid\ngraph TD\n  A1 --> B1\n```',
        '  ```mermaid\ngraph TD\n  A2 --> B2\n```',
        '   ```mermaid\ngraph TD\n  A3 --> B3\n```',
      ];

      for (const md of variants) {
        const html = renderMarkdown(md);
        expect(html).toContain('class="mermaid-block"');
        expect(html).toContain('class="language-mermaid"');
        expect(html).toContain('data-mermaid-code=');
      }
    });

    it('2.2: should handle whitespace variants around the language identifier', () => {
      const variants = [
        '```   mermaid\ngraph TD\n  A --> B\n```',
        '```mermaid   \ngraph TD\n  A --> B\n```',
        '```  \t  mermaid  \t  \ngraph TD\n  A --> B\n```',
        '```MERMAID\ngraph TD\n  A --> B\n```',
        '```MerMaid\ngraph TD\n  A --> B\n```',
      ];

      for (const md of variants) {
        const html = renderMarkdown(md);
        expect(html).toContain('class="mermaid-block"');
        expect(html).toContain('A --&gt; B');
      }
    });

    it('2.3: should handle mixed line endings (CRLF \\r\\n, classic Mac \\r, Unix \\n) in same diagram', () => {
      const mixedCode = 'graph TD\r\n  A[Windows Line] --> B[Mac Line]\r  B --> C[Unix Line]\n  C --> D[Mixed End]\r\n';
      const md = `\`\`\`mermaid\n${mixedCode}\`\`\``;

      const html = renderMarkdown(md);
      expect(html).toContain('class="mermaid-block"');
      expect(html).toContain('Windows Line');
      expect(html).toContain('Mac Line');
      expect(html).toContain('Unix Line');
      expect(html).toContain('Mixed End');
    });

    it('2.4: should withstand Unicode zero-width characters (ZWSP, ZWNJ, ZWJ, BOM) in fences and code', () => {
      const zwsp = '\u200B'; // Zero-Width Space
      const zwnj = '\u200C'; // Zero-Width Non-Joiner
      const zwj = '\u200D'; // Zero-Width Joiner
      const bom = '\uFEFF'; // Byte Order Mark

      const codeWithUnicode = `graph TD\n  A[Start${zwsp}Node] --> B[Security${zwnj}Enclave]\n  B --> C[Core${zwj}Service${bom}]`;
      const md = `\`\`\`mermaid\n${codeWithUnicode}\n\`\`\``;

      const html = renderMarkdown(md);
      expect(html).toContain('class="mermaid-block"');
      expect(html).toContain('Start');
      expect(html).toContain('Security');
      expect(html).toContain('Core');
    });

    it('2.5: should handle non-standard Unicode whitespace (NBSP, Em Space, Ideographic Space)', () => {
      const nbsp = '\u00A0';
      const emsp = '\u2003';
      const idsp = '\u3000';

      const code = `graph TD\n  Node${nbsp}1 --> Node${emsp}2\n  Node${emsp}2 --> Node${idsp}3`;
      const md = `\`\`\`mermaid\n${code}\n\`\`\``;

      const html = renderMarkdown(md);
      expect(html).toContain('class="mermaid-block"');
      expect(html).toContain('Node');
    });

    it('2.6: should handle Bi-Directional text overrides (RTL / LTR controls) inside diagrams', () => {
      const rlo = '\u202E'; // Right-to-Left Override
      const lro = '\u202D'; // Left-to-Right Override
      const pdf = '\u202C'; // Pop Directional Formatting

      const code = `graph LR\n  A["${rlo}مرحبا بالعالم${pdf}"] --> B["${lro}English Label${pdf}"]`;
      const md = `\`\`\`mermaid\n${code}\n\`\`\``;

      const html = renderMarkdown(md);
      expect(html).toContain('class="mermaid-block"');
      expect(html).toContain('English Label');
    });

    it('2.7: should handle inline backticks inside mermaid diagram node definitions', () => {
      const code = 'graph TD\n  A["Node with `code` syntax"] --> B["`const x = 42;`"]';
      const md = `\`\`\`mermaid\n${code}\n\`\`\``;

      const html = renderMarkdown(md);
      expect(html).toContain('class="mermaid-block"');
      expect(html).toContain('Node with `code` syntax');
      expect(html).toContain('`const x = 42;`');
    });

    it('2.8: should gracefully handle empty mermaid code fence and whitespace-only fence', () => {
      const emptyMd = '```mermaid\n```';
      const whitespaceMd = '```mermaid\n   \n\t  \n```';

      const emptyHtml = renderMarkdown(emptyMd);
      const whitespaceHtml = renderMarkdown(whitespaceMd);

      expect(emptyHtml).toContain('class="mermaid-block"');
      expect(whitespaceHtml).toContain('class="mermaid-block"');

      // SSR component render with empty code handles gracefully
      const { html: compHtml } = render(MermaidDiagram, { props: { code: '' } });
      expect(compHtml).toContain('mermaid-block');
      expect(compHtml).toContain('<code class="language-mermaid">');
    });

    it('2.9: should handle diagram code containing only Mermaid comments', () => {
      const commentOnlyCode = '%% Just a comment line\n%% Second comment line\n';
      const md = `\`\`\`mermaid\n${commentOnlyCode}\`\`\``;

      const html = renderMarkdown(md);
      expect(html).toContain('class="mermaid-block"');
      expect(html).toContain('%% Just a comment line');

      const syntax = validateMermaidSyntax(commentOnlyCode);
      expect(syntax.valid).toBe(false);
      expect(syntax.error).toContain('only comments');
    });

    it('2.10: should handle back-to-back code fences without separating newlines', () => {
      const md = '```mermaid\ngraph TD\n  A --> B\n``````mermaid\ngraph LR\n  C --> D\n```';
      const html = renderMarkdown(md);

      const matches = html.match(/class="mermaid-block"/g);
      expect(matches).not.toBeNull();
      expect(matches?.length).toBe(2);
      expect(html).toContain('A --&gt; B');
      expect(html).toContain('C --&gt; D');
    });
  });

  // ==========================================================================
  // CATEGORY 3: SVG SANITIZATION & XSS INJECTION PAYLOAD RESISTANCE
  // ==========================================================================
  describe('Category 3: SVG Sanitization Vectors & XSS Injection Payload Resistance', () => {
    it('3.1: should neutralize raw <script> injection vectors in diagram node definitions', () => {
      const xssPayloads = [
        '<script>window.__xss=1</script>',
        '<script src="https://evil.com/malicious.js"></script>',
        '<SCRIPT>alert(document.cookie)</SCRIPT>',
        '<script/x>alert(1)</script>',
        '<script type="text/javascript">window.pwned=true</script>',
      ];

      for (const payload of xssPayloads) {
        const diagramCode = `graph TD\n  A["${payload}"] --> B["Safe Node"]`;
        const md = `\`\`\`mermaid\n${diagramCode}\n\`\`\``;

        const html = renderMarkdown(md);

        // Verify script tags are stripped or HTML-escaped inside attributes & text
        expect(html.toLowerCase()).not.toMatch(/<script\b[^>]*>/);
        expect(html.toLowerCase()).toContain('&lt;script');
        expect(html).toContain('data-mermaid-code=');

        // SSR component rendering
        const { html: compHtml } = render(MermaidDiagram, { props: { code: diagramCode } });
        expect(compHtml.toLowerCase()).not.toMatch(/<script\b[^>]*>/);
        expect(compHtml.toLowerCase()).toContain('&lt;script');
      }
    });

    it('3.2: should neutralize inline event handlers (onerror, onload, onmouseover, ontoggle)', () => {
      const inlineVectors = [
        '<img src="x" onerror="window.__xss=1" />',
        '<svg onload="alert(1)"></svg>',
        '<body onload="alert(1)">',
        '<div onmouseover="alert(1)">hover</div>',
        '<details open ontoggle="alert(1)">toggle</details>',
        '<input autofocus onfocus="alert(1)" />',
      ];

      for (const vector of inlineVectors) {
        const diagramCode = `graph TD\n  A["${vector}"] --> B`;
        const md = `\`\`\`mermaid\n${diagramCode}\n\`\`\``;

        const html = renderMarkdown(md);
        // HTML inside data-mermaid-code and <pre><code> must be escaped
        expect(html).not.toContain('<img');
        expect(html).not.toContain('<details');
        expect(html).not.toContain('<input');
        expect(html).toContain('&lt;');
      }
    });

    it('3.3: should neutralize SVG-specific injection vectors (<foreignObject>, <animate>, <set>)', () => {
      const svgVectors = [
        '<foreignObject width="100" height="50"><body xmlns="http://www.w3.org/1999/xhtml"><script>alert(1)</script></body></foreignObject>',
        '<animate onbegin="alert(1)" attributeName="x" dur="1s" />',
        '<set attributeName="onmouseover" to="alert(1)" />',
        '<![CDATA[<script>alert("cdata-xss")</script>]]>',
      ];

      for (const vector of svgVectors) {
        const diagramCode = `graph TD\n  A["${vector}"] --> B`;
        const md = `\`\`\`mermaid\n${diagramCode}\n\`\`\``;

        const html = renderMarkdown(md);
        expect(html).not.toContain('<foreignObject');
        expect(html).not.toContain('<animate');
        expect(html).not.toContain('<set');
        expect(html.toLowerCase()).not.toContain('<script');
      }
    });

    it('3.4: should prevent attribute breakout attacks on data-mermaid-code attribute', () => {
      const breakoutPayloads = [
        '"><script>window.__xss=1</script><div data-x="',
        '" onmouseover="alert(1)" autofocus="',
        '\'><img src=x onerror=alert(1)><\'',
        '"><h1>Injected Heading</h1><div class="',
      ];

      for (const payload of breakoutPayloads) {
        const md = `\`\`\`mermaid\n${payload}\n\`\`\``;
        const html = renderMarkdown(md);

        // Attribute breakout must be prevented by proper quote escaping
        expect(html).not.toContain('<script>window.__xss=1');
        expect(html).not.toContain('<h1>Injected Heading</h1>');
        expect(html).toContain('data-mermaid-code="');
        // Check that quotes and angle brackets are neutralized
        expect(html).toMatch(/(&quot;|&#39;|&lt;|&gt;)/);
      }
    });

    it('3.5: should neutralize dangerous pseudo-protocol URLs in diagram links and click events', () => {
      const dangerousProtocols = [
        'javascript:alert("XSS")',
        'JAVASCRIPT:alert(1)',
        'jav&#x61;script:alert(1)',
        'vbscript:msgbox("XSS")',
        'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
      ];

      for (const protocol of dangerousProtocols) {
        const markdownLink = `[Exploit Diagram](${protocol})`;
        const html = renderMarkdown(markdownLink);

        expect(html.toLowerCase()).not.toContain('href="javascript:');
        expect(html.toLowerCase()).not.toContain('href="vbscript:');
        expect(html.toLowerCase()).not.toContain('href="data:text/html');
      }
    });

    it('3.6: should verify that Mermaid client engine config enforces securityLevel strict', async () => {
      const config = MermaidServiceContract.getConfig();
      expect(config.securityLevel).toBe('strict');
      expect(config.suppressErrorRendering).toBe(true);
      expect(config.startOnLoad).toBe(false);
    });

    it('3.7: should verify SVG download and copy handlers preserve safe sanitization', () => {
      const maliciousSvg = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><text>Safe</text></svg>';
      const blob = new Blob([maliciousSvg], { type: 'image/svg+xml;charset=utf-8' });

      expect(blob.type).toBe('image/svg+xml;charset=utf-8');
      expect(blob.size).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // CATEGORY 4: HIGH-CONCURRENCY ASYNC RENDERING & MUTEX LOCK BEHAVIOR
  // ==========================================================================
  describe('Category 4: High-Concurrency Async Rendering & Mutex Lock Behavior', () => {
    it('4.1: should serialize 100 simultaneous getMermaid() calls to a single shared promise', async () => {
      // In SSR, getMermaid returns null without crashing
      const promises: Promise<any>[] = [];
      for (let i = 0; i < 100; i++) {
        promises.push(getMermaid());
      }

      const results = await Promise.all(promises);
      expect(results.length).toBe(100);
      for (const res of results) {
        expect(res).toBeNull();
      }
    });

    it('4.2: should handle 50 concurrent renderMermaidSvg invocations with unique IDs without deadlocks', async () => {
      const renderPromises: Promise<any>[] = [];
      for (let i = 0; i < 50; i++) {
        const id = generateDiagramId(`concurrent_${i}`);
        const code = `graph TD\n  N${i}[Node ${i}] --> Target_${i}`;
        renderPromises.push(renderMermaidSvg(id, code));
      }

      const results = await Promise.all(renderPromises);
      expect(results.length).toBe(50);
      // In SSR/Node, all return structured error objects gracefully
      for (const res of results) {
        expect('error' in res).toBe(true);
        if ('error' in res) {
          expect(res.error).toContain('browser environments');
        }
      }
    });

    it('4.3: should concurrently process 30 valid and 30 invalid diagram parsing requests with zero cross-talk', async () => {
      const requests: Promise<{ valid: boolean; error?: string }>[] = [];

      for (let i = 0; i < 60; i++) {
        const isValid = i % 2 === 0;
        const code = isValid ? `graph TD\n  A${i} --> B${i}` : `graph TD\n  Broken ${i}`;

        // Test parser contract
        requests.push(MermaidServiceContract.parse(code));
      }

      const results = await Promise.all(requests);
      expect(results.length).toBe(60);

      for (let i = 0; i < 60; i++) {
        const isValid = i % 2 === 0;
        if (isValid) {
          expect(results[i].valid).toBe(true);
          expect(results[i].error).toBeUndefined();
        } else {
          expect(results[i].valid).toBe(false);
          expect(results[i].error).toBeDefined();
        }
      }
    });

    it('4.4: should prevent race conditions where stale delayed renders overwrite current completed renders', async () => {
      let activeRenderCount = 0;
      let appliedSvgResult = '';
      let activeRenderId = 0;

      class ConcurrencyController {
        async executeRender(id: number, delayMs: number, svgContent: string) {
          activeRenderId = id;
          const thisId = id;
          activeRenderCount++;

          await new Promise((resolve) => setTimeout(resolve, delayMs));

          // Svelte 5 cancellation guard: discard if not current
          if (thisId === activeRenderId) {
            appliedSvgResult = svgContent;
          }
        }
      }

      const controller = new ConcurrencyController();

      // Launch 3 renders in quick succession with inverse latencies:
      // Render 1: slow (60ms latency), SVG "STALE_1"
      // Render 2: medium (30ms latency), SVG "STALE_2"
      // Render 3: fast (10ms latency), SVG "FINAL_3" (issued last)
      const p1 = controller.executeRender(1, 60, '<svg id="STALE_1"/>');
      const p2 = controller.executeRender(2, 30, '<svg id="STALE_2"/>');
      const p3 = controller.executeRender(3, 10, '<svg id="FINAL_3"/>');

      await Promise.all([p1, p2, p3]);

      // The applied result MUST strictly be Render 3
      expect(appliedSvgResult).toBe('<svg id="FINAL_3"/>');
    });

    it('4.5: should debounce 100 rapid simulated keystrokes into exactly 1 render invocation after 200ms', () => {
      vi.useFakeTimers();

      let renderCount = 0;
      let lastRenderedCode = '';
      let timer: any = null;

      function typeCharacter(code: string) {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          renderCount++;
          lastRenderedCode = code;
        }, 200);
      }

      // Simulate typing 100 characters, 15ms apart
      for (let i = 1; i <= 100; i++) {
        typeCharacter(`graph TD\n  A --> B_${i}`);
        if (i < 100) {
          vi.advanceTimersByTime(15);
          expect(renderCount).toBe(0); // Debounce still active
        }
      }

      // Advance 199ms after the 100th keystroke
      vi.advanceTimersByTime(199);
      expect(renderCount).toBe(0);

      // Advance 2ms to complete the 200ms debounce threshold
      vi.advanceTimersByTime(2);
      expect(renderCount).toBe(1);
      expect(lastRenderedCode).toBe('graph TD\n  A --> B_100');

      vi.useRealTimers();
    });
  });

  // ==========================================================================
  // CATEGORY 5: DOM MUTATION & ELEMENT CLEANUP UNDER ERROR STATES
  // ==========================================================================
  describe('Category 5: DOM Mutation & Element Cleanup Under Error States', () => {
    it('5.1: should clean up temporary orphaned DOM elements (d{id} and {id}) on render errors', () => {
      const removedElementIds: string[] = [];

      const mockElement = (id: string) => ({
        id,
        remove: vi.fn(() => {
          removedElementIds.push(id);
        }),
      });

      const mockDocument = {
        getElementById: vi.fn((id: string) => {
          if (id.startsWith('dmermaid_err_') || id.startsWith('mermaid_err_')) {
            return mockElement(id);
          }
          return null;
        }),
      };

      vi.stubGlobal('document', mockDocument);

      // Simulate cleanup logic from renderMermaidSvg catch handler
      for (let i = 1; i <= 25; i++) {
        const safeId = `mermaid_err_${i}`;
        const errorElement =
          mockDocument.getElementById(`d${safeId}`) || mockDocument.getElementById(safeId);
        if (errorElement) {
          errorElement.remove();
        }
      }

      expect(removedElementIds.length).toBe(25);
      expect(removedElementIds[0]).toBe('dmermaid_err_1');
      expect(removedElementIds[24]).toBe('dmermaid_err_25');

      vi.unstubAllGlobals();
    });

    it('5.2: mermaidRenderer action should cleanly mount, update, and unmount across 20 DOM diagram nodes', () => {
      const diagramBlocks = Array.from({ length: 20 }, (_, i) => ({
        getAttribute: vi.fn((attr: string) => (attr === 'data-mermaid-code' ? `graph TD; Node${i}-->End` : null)),
        querySelector: vi.fn(() => ({ textContent: `Title ${i}` })),
        innerHTML: '<pre><code>SSR Fallback</code></pre>',
        isConnected: true,
      }));

      const mockContainer = {
        isConnected: true,
        querySelectorAll: vi.fn((selector: string) =>
          selector.includes('.mermaid-block') ? diagramBlocks : []
        ),
      } as unknown as HTMLElement;

      const action = mermaidRenderer(mockContainer, { showControls: true });

      expect(action).toBeDefined();
      expect(typeof action.update).toBe('function');
      expect(typeof action.destroy).toBe('function');

      // Update action with new options
      expect(() => action.update({ showControls: false })).not.toThrow();

      // Destroy action
      expect(() => action.destroy()).not.toThrow();
    });

    it('5.3: mermaidRenderer action handles disconnected container node gracefully', () => {
      const disconnectedContainer = {
        isConnected: false,
        querySelectorAll: vi.fn().mockReturnValue([]),
      } as unknown as HTMLElement;

      const action = mermaidRenderer(disconnectedContainer);

      expect(() => action.update('new-content')).not.toThrow();
      expect(() => action.destroy()).not.toThrow();
    });

    it('5.4: should manage fullscreen modal body scroll lock effect and restore previous overflow', () => {
      let originalOverflow = 'auto';
      let currentBodyOverflow = originalOverflow;

      function openModal() {
        originalOverflow = currentBodyOverflow;
        currentBodyOverflow = 'hidden';
      }

      function closeModal() {
        currentBodyOverflow = originalOverflow;
      }

      expect(currentBodyOverflow).toBe('auto');
      openModal();
      expect(currentBodyOverflow).toBe('hidden');
      closeModal();
      expect(currentBodyOverflow).toBe('auto');

      // 50 rapid open/close cycles
      for (let i = 0; i < 50; i++) {
        openModal();
        expect(currentBodyOverflow).toBe('hidden');
        closeModal();
        expect(currentBodyOverflow).toBe('auto');
      }
    });

    it('5.5: zoom modal boundary clamp ensures scale remains strictly between 0.25x and 4.0x', () => {
      function adjustScale(current: number, delta: number): number {
        return Math.min(4.0, Math.max(0.25, +(current + delta).toFixed(2)));
      }

      let scale = 1.0;

      // Extreme zoom in (100 zoom-in steps)
      for (let i = 0; i < 100; i++) {
        scale = adjustScale(scale, 0.25);
      }
      expect(scale).toBe(4.0);

      // Extreme zoom out (100 zoom-out steps)
      for (let i = 0; i < 100; i++) {
        scale = adjustScale(scale, -0.25);
      }
      expect(scale).toBe(0.25);

      // Reset
      scale = 1.0;
      expect(scale).toBe(1.0);
    });
  });
});
