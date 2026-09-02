/**
 * Svelte 5 Action: mermaidRenderer
 * Hydrates static .mermaid-block elements in markdown preview containers into live interactive MermaidDiagram instances.
 */
import { mount, unmount, tick } from 'svelte';
import { browser } from '$app/environment';
import MermaidDiagram from '$lib/components/MermaidDiagram.svelte';

export interface MermaidRendererOptions {
  showControls?: boolean;
  content?: string;
}

export type MermaidRendererParam = MermaidRendererOptions | string | undefined;

export function mermaidRenderer(
  node: HTMLElement,
  optionsOrContent?: MermaidRendererParam
) {
  let mountedInstances: Array<Record<string, any>> = [];

  function getShowControls(): boolean {
    if (typeof optionsOrContent === 'object' && optionsOrContent !== null) {
      return optionsOrContent.showControls ?? true;
    }
    return true;
  }

  async function hydrate() {
    // Unmount any previously mounted instances
    for (const inst of mountedInstances) {
      try {
        unmount(inst);
      } catch {
        // ignore unmount errors
      }
    }
    mountedInstances = [];

    // Only execute on client in DOM environments
    if (!browser && typeof window === 'undefined') {
      return;
    }

    await tick();

    if (!node || !node.isConnected) {
      return;
    }

    const blocks = node.querySelectorAll<HTMLElement>('.mermaid-block[data-mermaid-code]');
    blocks.forEach((block) => {
      const code = block.getAttribute('data-mermaid-code') || '';
      if (!code) return;

      const titleEl = block.querySelector('.diagram-title');
      const title = titleEl ? titleEl.textContent?.trim() || '' : '';

      // Clear static SSR fallback before mounting interactive component
      block.innerHTML = '';

      try {
        const instance = mount(MermaidDiagram, {
          target: block,
          props: {
            code,
            title: title || undefined,
            showControls: getShowControls(),
          },
        });
        mountedInstances.push(instance);
      } catch (err) {
        console.error('Failed to mount MermaidDiagram in block:', err);
      }
    });
  }

  // Initial hydration
  hydrate();

  return {
    update(newOptionsOrContent?: MermaidRendererParam) {
      optionsOrContent = newOptionsOrContent;
      hydrate();
    },
    destroy() {
      for (const inst of mountedInstances) {
        try {
          unmount(inst);
        } catch {
          // ignore
        }
      }
      mountedInstances = [];
    },
  };
}
