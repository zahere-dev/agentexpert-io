import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import vercel from '@astrojs/vercel';
import keystatic from '@keystatic/astro';

export default defineConfig({
  integrations: [react(), keystatic()],
  adapter: vercel(),
  output: 'server',
});
