import { config, fields, collection, singleton } from '@keystatic/core';

export default config({
  storage: { kind: 'github', repo: 'zahere-dev/agentexpert-io' },
  ui: {
    navigation: {
      'Content': ['roadmaps', 'patterns', 'tips', 'caseStudies'],
      'Site': ['siteSettings'],
    },
  },
  collections: {
    roadmaps: collection({
      label: 'Roadmaps',
      slugField: 'title',
      path: 'src/content/roadmaps/*',
      format: { contentField: 'content' },
      schema: {
        title: fields.slug({ name: { label: 'Title' } }),
        description: fields.text({ label: 'Description', multiline: true }),
        level: fields.select({
          label: 'Level',
          options: [
            { label: 'Beginner', value: 'beginner' },
            { label: 'Intermediate', value: 'intermediate' },
            { label: 'Advanced', value: 'advanced' },
          ],
          defaultValue: 'beginner',
        }),
        tags: fields.array(fields.text({ label: 'Tag' }), { label: 'Tags', itemLabel: p => p.value }),
        publishedAt: fields.date({ label: 'Published At' }),
        featured: fields.checkbox({ label: 'Featured on Homepage', defaultValue: false }),
        content: fields.markdoc({ label: 'Content' }),
      },
    }),
    patterns: collection({
      label: 'Patterns',
      slugField: 'title',
      path: 'src/content/patterns/*',
      format: { contentField: 'content' },
      schema: {
        title: fields.slug({ name: { label: 'Title' } }),
        description: fields.text({ label: 'Description', multiline: true }),
        category: fields.select({
          label: 'Category',
          options: [
            { label: 'Tool Use', value: 'tool-use' },
            { label: 'Memory & State', value: 'memory-state' },
            { label: 'Multi-Agent', value: 'multi-agent' },
            { label: 'RAG', value: 'rag' },
            { label: 'MCP', value: 'mcp' },
            { label: 'Human-in-the-Loop', value: 'human-loop' },
          ],
          defaultValue: 'tool-use',
        }),
        tags: fields.array(fields.text({ label: 'Tag' }), { label: 'Tags', itemLabel: p => p.value }),
        publishedAt: fields.date({ label: 'Published At' }),
        content: fields.markdoc({ label: 'Content' }),
      },
    }),
    tips: collection({
      label: 'Tips & Tricks',
      slugField: 'title',
      path: 'src/content/tips/*',
      format: { contentField: 'content' },
      schema: {
        title: fields.slug({ name: { label: 'Title' } }),
        description: fields.text({ label: 'Description', multiline: true }),
        tags: fields.array(fields.text({ label: 'Tag' }), { label: 'Tags', itemLabel: p => p.value }),
        publishedAt: fields.date({ label: 'Published At' }),
        content: fields.markdoc({ label: 'Content' }),
      },
    }),
    caseStudies: collection({
      label: 'Case Studies',
      slugField: 'title',
      path: 'src/content/case-studies/*',
      format: { contentField: 'content' },
      schema: {
        title: fields.slug({ name: { label: 'Title' } }),
        description: fields.text({ label: 'Description', multiline: true }),
        industry: fields.text({ label: 'Industry' }),
        stack: fields.array(fields.text({ label: 'Technology' }), { label: 'Tech Stack', itemLabel: p => p.value }),
        outcome: fields.text({ label: 'Key Outcome', multiline: true }),
        publishedAt: fields.date({ label: 'Published At' }),
        content: fields.markdoc({ label: 'Content' }),
      },
    }),
  },
  singletons: {
    siteSettings: singleton({
      label: 'Site Settings',
      path: 'src/content/site-settings',
      schema: {
        siteTitle: fields.text({ label: 'Site Title', defaultValue: 'Agent Expert' }),
        tagline: fields.text({ label: 'Tagline', defaultValue: 'The Definitive Resource for Building AI Agents' }),
        authorName: fields.text({ label: 'Author Name', defaultValue: 'Zahiruddin Tavargere' }),
        authorBio: fields.text({ label: 'Author Bio', multiline: true }),
        twitterUrl: fields.text({ label: 'Twitter URL' }),
        youtubeUrl: fields.text({ label: 'YouTube URL' }),
        linkedinUrl: fields.text({ label: 'LinkedIn URL' }),
        newsletterUrl: fields.text({ label: 'Newsletter URL' }),
      },
    }),
  },
});
