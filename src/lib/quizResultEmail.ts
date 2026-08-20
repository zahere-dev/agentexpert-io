interface CategoryScore {
  category: string;
  correct: number;
  total: number;
  percent: number;
}

interface QuizResultEmailInput {
  name: string;
  level: string;
  overallPercent: number;
  categoryScores: CategoryScore[];
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const CATEGORY_COLOR: Record<string, string> = {
  Knowledge: "#2563eb",
  Application: "#16a34a",
  Analysis: "#d97706",
  Creativity: "#9333ea",
};

function barsHtml(categoryScores: CategoryScore[]): string {
  return categoryScores
    .map(
      (c) => `
        <tr>
          <td style="padding:6px 0;font-size:13px;color:#374151;width:110px;">${c.category}</td>
          <td style="padding:6px 0;">
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr>
              <td style="background:#e5e7eb;border-radius:999px;height:8px;">
                <table role="presentation" cellpadding="0" cellspacing="0" style="height:8px;width:${c.percent}%;background:${CATEGORY_COLOR[c.category] ?? "#111"};border-radius:999px;"><tr><td>&nbsp;</td></tr></table>
              </td>
            </tr></table>
          </td>
          <td style="padding:6px 0 6px 10px;font-size:13px;color:#111827;width:70px;text-align:right;">${c.correct}/${c.total} · ${c.percent}%</td>
        </tr>`
    )
    .join("");
}

export function quizResultEmailHtml({ name, level, overallPercent, categoryScores }: QuizResultEmailInput): string {
  const safeName = escapeHtml(name);
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <tr>
    <td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;">
        <tr>
          <td style="padding:32px 32px 24px;">
            <p style="margin:0 0 20px;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;">agentexpert.io</p>
            <h1 style="margin:0 0 6px;font-size:20px;line-height:1.3;font-weight:700;color:#111111;">Hi ${safeName}, your level: ${level}</h1>
            <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#4b5563;">
              You scored <strong style="color:#111111;">${overallPercent}%</strong> overall. Here's the breakdown by skill area:
            </p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
              ${barsHtml(categoryScores)}
            </table>
            <p style="margin:0 0 4px;font-size:13px;line-height:1.6;color:#4b5563;">
              Want a guided path to close the gaps? Reply to this email or check the resources on
              <a href="https://www.agentexpert.io" style="color:#111111;">agentexpert.io</a>.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;border-radius:0 0 12px 12px;">
            <p style="margin:0 0 8px;font-size:12px;color:#9ca3af;">More from Zahiruddin Tavargere:</p>
            <p style="margin:0;font-size:12px;">
              <a href="https://www.youtube.com/@adaptiveengineer" style="color:#6b7280;text-decoration:none;">YouTube</a>
              &nbsp;·&nbsp;
              <a href="https://newsletter.adaptiveengineer.com/" style="color:#6b7280;text-decoration:none;">Newsletter</a>
              &nbsp;·&nbsp;
              <a href="https://zahere.com" style="color:#6b7280;text-decoration:none;">Blog</a>
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
`;
}

export function quizResultEmailText({ name, level, overallPercent, categoryScores }: QuizResultEmailInput): string {
  return [
    `Hi ${name}, your level: ${level}`,
    `Overall score: ${overallPercent}%`,
    "",
    "Breakdown:",
    ...categoryScores.map((c) => `- ${c.category}: ${c.correct}/${c.total} (${c.percent}%)`),
    "",
    "More from Zahiruddin Tavargere:",
    "YouTube: https://www.youtube.com/@adaptiveengineer",
    "Newsletter: https://newsletter.adaptiveengineer.com/",
    "Blog: https://zahere.com",
  ].join("\n");
}
