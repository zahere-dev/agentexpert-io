import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const assets = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './src/content/assets' }),
  schema: ({ image }) => z.object({
    title: z.string(),
    description: z.string(),
    type: z.enum(['github', 'zip', 'pdf', 'ppt', 'link']),
    url: z.string().url(),
    publishedAt: z.string().optional(),
    image: image().optional(),
  }),
});

export const collections = { assets };
