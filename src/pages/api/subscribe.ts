import type { APIRoute } from 'astro';
import { getEntry } from 'astro:content';
import { z } from 'zod';
import { Resend } from 'resend';
import { deliveryEmailHtml, deliveryEmailText } from '../../lib/deliveryEmail';

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
  const fromEmail = import.meta.env.RESEND_FROM_EMAIL || 'noreply@agentexpert.io';

  if (apiKey) {
    const resend = new Resend(apiKey);

    if (audienceId) {
      try {
        await resend.contacts.create({ email, audienceId, unsubscribed: false });
      } catch (err) {
        // A duplicate contact or a transient Resend error shouldn't block
        // delivery of an asset the visitor already asked for.
        console.error('Resend contact creation failed:', err);
      }
    }

    const emailInput = {
      title: asset.data.title,
      description: asset.data.description,
      url: asset.data.url,
      type: asset.data.type,
    };

    try {
      await resend.emails.send({
        from: `agentexpert.io <${fromEmail}>`,
        to: email,
        subject: `Your download: ${asset.data.title}`,
        html: deliveryEmailHtml(emailInput),
        text: deliveryEmailText(emailInput),
      });
    } catch (err) {
      console.error('Resend email send failed:', err);
      return new Response(JSON.stringify({ error: 'Could not send the email' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
