type AssetType = "github" | "zip" | "pdf" | "ppt" | "link";

const ACTION_LABEL: Record<AssetType, string> = {
  github: "View on GitHub",
  zip: "Download ZIP",
  pdf: "Download PDF",
  ppt: "Download slides",
  link: "Open link",
};

interface DeliveryEmailInput {
  title: string;
  description: string;
  url: string;
  type: AssetType;
}

export function deliveryEmailHtml({ title, description, url, type }: DeliveryEmailInput): string {
  const actionLabel = ACTION_LABEL[type];

  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <tr>
    <td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;">
        <tr>
          <td style="padding:32px 32px 28px;">
            <p style="margin:0 0 20px;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;">agentexpert.io</p>
            <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;font-weight:700;color:#111111;">Here's your download</h1>
            <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#4b5563;">
              Thanks for grabbing <strong style="color:#111111;">${title}</strong>. ${description}
            </p>
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td style="border-radius:8px;background:#111111;">
                  <a href="${url}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">
                    ${actionLabel} →
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#9ca3af;">
              If the button doesn't work, copy this link: <a href="${url}" style="color:#6b7280;">${url}</a>
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

export function deliveryEmailText({ title, description, url, type }: DeliveryEmailInput): string {
  const actionLabel = ACTION_LABEL[type];
  return [
    `Here's your download: ${title}`,
    "",
    description,
    "",
    `${actionLabel}: ${url}`,
    "",
    "More from Zahiruddin Tavargere:",
    "YouTube: https://www.youtube.com/@adaptiveengineer",
    "Newsletter: https://newsletter.adaptiveengineer.com/",
    "Blog: https://zahere.com",
  ].join("\n");
}
