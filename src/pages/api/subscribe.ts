import type { APIRoute } from 'astro';
import { getEntry } from 'astro:content';
import { z } from 'zod';
import { Resend } from 'resend';

export const prerender = false;

const bodySchema = z.object({
  email: z.string().email(),
  assetId: z.string().min(1),
  // Honeypot: real visitors never fill this in.
  company: z.string().max(0).optional(),
});

export const POST: APIRoute = async ({ request }) => {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);

  if (!parsed.success) {
    return new Response(JSON.stringify({ error: 'Invalid request' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { email, assetId } = parsed.data;

  const asset = await getEntry('assets', assetId);
  if (!asset) {
    return new Response(JSON.stringify({ error: 'Unknown asset' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const apiKey = import.meta.env.RESEND_API_KEY;
  const audienceId = import.meta.env.RESEND_AUDIENCE_ID;

  if (apiKey && audienceId) {
    try {
      const resend = new Resend(apiKey);
      await resend.contacts.create({ email, audienceId, unsubscribed: false });
    } catch (err) {
      // A duplicate contact or a transient Resend error shouldn't block
      // delivery of an asset the visitor already asked for.
      console.error('Resend contact creation failed:', err);
    }
  }

  return new Response(
    JSON.stringify({ url: asset.data.url, type: asset.data.type, title: asset.data.title }),
    { headers: { 'Content-Type': 'application/json' } }
  );
};
