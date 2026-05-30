import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import node from '@astrojs/node';
import keystatic from '@keystatic/astro';

export default defineConfig({
  integrations: [react(), keystatic()],
  adapter: node({ mode: 'passthrough' }),
  output: 'hybrid',
});
