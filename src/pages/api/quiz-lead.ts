import type { APIRoute } from 'astro';
import { z } from 'zod';
import { Resend } from 'resend';
import { quizResultEmailHtml, quizResultEmailText } from '../../lib/quizResultEmail';

export const prerender = false;

const bodySchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  // Honeypot: real visitors never fill this in.
  company: z.string().max(0).optional(),
  level: z.string().min(1),
  overallPercent: z.number().min(0).max(100),
  categoryScores: z.array(
    z.object({
      category: z.string(),
      correct: z.number(),
      total: z.number(),
      percent: z.number(),
    })
  ),
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

  const { name, email, level, overallPercent, categoryScores } = parsed.data;

  const apiKey = import.meta.env.RESEND_API_KEY;
  const audienceId = import.meta.env.RESEND_AUDIENCE_ID;
  const fromEmail = import.meta.env.RESEND_FROM_EMAIL || 'noreply@agentexpert.io';

  if (apiKey) {
    const resend = new Resend(apiKey);

    if (audienceId) {
      try {
        await resend.contacts.create({ email, audienceId, unsubscribed: false, firstName: name });
      } catch (err) {
        console.error('Resend contact creation failed:', err);
      }
    }

    const emailInput = { name, level, overallPercent, categoryScores };

    try {
      await resend.emails.send({
        from: `agentexpert.io <${fromEmail}>`,
        to: email,
        subject: `Your agent-building level: ${level}`,
        html: quizResultEmailHtml(emailInput),
        text: quizResultEmailText(emailInput),
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
