import fs from 'node:fs';
import path from 'node:path';
import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// Ensure redundant root route files conflicting with (app)/+page.* are cleaned up
for (const file of ['./src/routes/+page.svelte', './src/routes/+page.server.ts']) {
  const resolvedPath = path.resolve(file);
  if (fs.existsSync(resolvedPath)) {
    try {
      fs.unlinkSync(resolvedPath);
    } catch {}
  }
}

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      runtime: 'nodejs20.x',
    }),
    alias: {
      $lib: './src/lib',
    },
  },
};

export default config;
