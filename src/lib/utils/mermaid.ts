/**
 * Mermaid.js Client Rendering Engine Singleton & Utilities
 * Optimized for SvelteKit 2 (Svelte 5) with full SSR / Node safety.
 */

import { browser } from '$app/environment';
import type { Mermaid, MermaidConfig } from 'mermaid';

export interface MermaidRenderResult {
  svg: string;
  bindFunctions?: (element: Element) => void;
}

export interface MermaidRenderError {
  message: string;
  str?: string;
  hash?: any;
}

/**
 * Clean Slate design system palette for cohesive diagram rendering.
 */
export const SLATE_THEME_VARIABLES = {
  primaryColor: '#f1f5f9', // slate-100
  primaryTextColor: '#0f172a', // slate-900
  primaryBorderColor: '#cbd5e1', // slate-300
  lineColor: '#64748b', // slate-500
  secondaryColor: '#f8fafc', // slate-50
  tertiaryColor: '#e2e8f0', // slate-200
  mainBkg: '#f8fafc',
  nodeBorder: '#94a3b8',
  clusterBkg: '#f1f5f9',
  clusterBorder: '#cbd5e1',
  titleColor: '#0f172a',
  edgeLabelBackground: '#ffffff',
  actorBorder: '#94a3b8',
  actorBkg: '#f8fafc',
  actorTextColor: '#0f172a',
  actorLineColor: '#64748b',
  signalColor: '#0f172a',
  signalTextColor: '#0f172a',
  labelBoxBkgColor: '#f8fafc',
  labelBoxBorderColor: '#cbd5e1',
  labelTextColor: '#0f172a',
  loopTextColor: '#0f172a',
  noteBorderColor: '#cbd5e1',
  noteBkgColor: '#fef3c7',
  noteTextColor: '#0f172a',
  activationBorderColor: '#2563eb',
  activationBkgColor: '#dbeafe',
  sequenceNumberColor: '#ffffff',

  // High-contrast, vibrant pie chart palette & typography
  pie1: '#2563eb', // Vibrant Blue
  pie2: '#0d9488', // Deep Teal
  pie3: '#d97706', // Warm Amber / Gold
  pie4: '#7c3aed', // Vivid Violet
  pie5: '#059669', // Emerald Green
  pie6: '#e11d48', // Rose Crimson
  pie7: '#0284c7', // Sky Cyan
  pie8: '#ea580c', // Coral Orange
  pie9: '#4f46e5', // Royal Indigo
  pie10: '#ca8a04', // Bright Yellow-Amber
  pie11: '#0891b2', // Deep Cyan
  pie12: '#be123c', // Dark Pink

  pieTitleTextSize: '18px',
  pieTitleTextColor: '#0f172a',
  pieSectionTextSize: '14px',
  pieSectionTextColor: '#ffffff',
  pieLegendTextSize: '14px',
  pieLegendTextColor: '#0f172a',
  pieStrokeColor: '#ffffff',
  pieStrokeWidth: '2px',
  pieOuterStrokeWidth: '2px',
  pieOuterStrokeColor: '#0f172a',
  pieOpacity: '0.95',

  fontFamily:
    'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  fontSize: '14px',
  textColor: '#0f172a',
};

let mermaidInstance: Mermaid | null = null;
let initializationPromise: Promise<Mermaid | null> | null = null;
let idCounter = 0;

/**
 * Check if Mermaid can be executed in the current environment.
 */
export function isMermaidSupported(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

/**
 * Generates a unique, valid DOM id for Mermaid diagram rendering.
 */
export function generateDiagramId(prefix = 'mermaid'): string {
  idCounter += 1;
  const timestamp = Date.now().toString(36);
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${timestamp}_${idCounter.toString(36)}_${randomSuffix}`;
}

/**
 * Lazy loads and initializes the Mermaid singleton in client context.
 */
export async function getMermaid(): Promise<Mermaid | null> {
  if (!isMermaidSupported()) {
    return null;
  }

  if (mermaidInstance) {
    return mermaidInstance;
  }

  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    try {
      const mermaidModule = await import('mermaid');
      mermaidInstance = mermaidModule.default;
      mermaidInstance.initialize({
        startOnLoad: false,
        securityLevel: 'loose',
        suppressErrorRendering: true,
        theme: 'base',
        themeVariables: SLATE_THEME_VARIABLES,
        pie: {
          useMaxWidth: true,
        },
        flowchart: {
          useMaxWidth: true,
          htmlLabels: true,
          curve: 'basis',
        },
        sequence: {
          useMaxWidth: true,
          showSequenceNumbers: true,
        },
        gantt: {
          useMaxWidth: true,
        },
        er: {
          useMaxWidth: true,
        },
      });
      return mermaidInstance;
    } catch (err) {
      console.error('Failed to load or initialize Mermaid:', err);
      mermaidInstance = null;
      return null;
    } finally {
      initializationPromise = null;
    }
  })();

  return initializationPromise;
}

/**
 * Initializes or re-initializes Mermaid with a specific theme.
 */
export async function initializeMermaid(theme: 'slate' | 'default' = 'slate'): Promise<Mermaid | null> {
  const mermaid = await getMermaid();
  if (!mermaid) return null;

  const config: MermaidConfig = {
    startOnLoad: false,
    securityLevel: 'loose',
    suppressErrorRendering: true,
  };

  if (theme === 'slate') {
    config.theme = 'base';
    config.themeVariables = SLATE_THEME_VARIABLES;
  } else {
    config.theme = 'default';
  }

  mermaid.initialize(config);
  return mermaid;
}

/**
 * Parses and validates Mermaid syntax without rendering SVG.
 */
export async function parseMermaidSyntax(
  code: string
): Promise<{ valid: boolean; error?: string }> {
  if (!code || typeof code !== 'string' || !code.trim()) {
    return { valid: false, error: 'Empty diagram definition' };
  }

  if (!isMermaidSupported()) {
    return { valid: false, error: 'Mermaid syntax parsing is only supported in browser environments' };
  }

  try {
    const mermaid = await getMermaid();
    if (!mermaid) {
      return { valid: false, error: 'Failed to initialize Mermaid engine' };
    }

    const isValid = await mermaid.parse(code.trim());
    return { valid: Boolean(isValid) };
  } catch (err: any) {
    const message = err?.message || err?.str || String(err);
    return { valid: false, error: message };
  }
}

/**
 * Renders a Mermaid diagram code string to responsive SVG.
 * Handles syntax errors gracefully and cleans up any DOM artifacts.
 */
export async function renderMermaidSvg(
  id: string,
  code: string
): Promise<{ svg: string; bindFunctions?: (element: Element) => void } | { error: string }> {
  if (!code || typeof code !== 'string' || !code.trim()) {
    return { error: 'Empty diagram definition' };
  }

  if (!isMermaidSupported()) {
    return { error: 'Mermaid rendering is only supported in browser environments' };
  }

  const safeId = id || generateDiagramId();

  try {
    const mermaid = await getMermaid();
    if (!mermaid) {
      return { error: 'Failed to initialize Mermaid engine' };
    }

    const result = await mermaid.render(safeId, code.trim());
    return {
      svg: result.svg,
      bindFunctions: result.bindFunctions,
    };
  } catch (err: any) {
    // Clean up potential orphaned DOM element left by Mermaid on error
    if (typeof document !== 'undefined') {
      const errorElement = document.getElementById(`d${safeId}`) || document.getElementById(safeId);
      if (errorElement) {
        errorElement.remove();
      }
    }

    const errorMessage = err?.message || err?.str || String(err);
    return { error: errorMessage };
  }
}
