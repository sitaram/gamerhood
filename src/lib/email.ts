import { Resend } from "resend";

let _resend: Resend | null = null;

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

const FROM = process.env.RESEND_FROM_EMAIL || "Gamerhood <noreply@gamerhood.gg>";

export async function sendWelcomeEmail(to: string, name: string) {
  const resend = getResend();
  if (!resend) return;

  await resend.emails.send({
    from: FROM,
    to,
    subject: "Welcome to Gamerhood!",
    html: `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
        <h1 style="color: #a855f7;">Welcome to Gamerhood!</h1>
        <p>Hey ${name},</p>
        <p>You're all set up as a parent on Gamerhood. Here's what you can do next:</p>
        <ul>
          <li><strong>Create designs</strong> — Use our AI Design Studio to bring ideas to life</li>
          <li><strong>Publish merch</strong> — Put designs on hoodies, tees, mugs, and more</li>
          <li><strong>Earn money</strong> — Get paid when your merch sells</li>
        </ul>
        <p>
          <a href="https://gamerhood.gg/create"
             style="display: inline-block; background: #a855f7; color: white; padding: 12px 24px;
                    border-radius: 8px; text-decoration: none; font-weight: bold;">
            Start Creating
          </a>
        </p>
        <p style="color: #888; font-size: 12px; margin-top: 32px;">
          You're receiving this because you created a Gamerhood account.
        </p>
      </div>
    `,
  });
}

export async function sendOrderConfirmation(
  to: string,
  order: {
    sessionId: string;
    total: number;
    items: { name: string; quantity: number; price: number }[];
  },
) {
  const resend = getResend();
  if (!resend) return;

  const itemsHtml = order.items
    .map(
      (i) =>
        `<tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${i.name}</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: center;">x${i.quantity}</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">$${(i.price / 100).toFixed(2)}</td>
        </tr>`,
    )
    .join("");

  await resend.emails.send({
    from: FROM,
    to,
    subject: "Your Gamerhood order is confirmed!",
    html: `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
        <h1 style="color: #a855f7;">Order Confirmed!</h1>
        <p>Your custom merch is being printed now. Here's your order summary:</p>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="border-bottom: 2px solid #a855f7;">
              <th style="text-align: left; padding: 8px 0;">Item</th>
              <th style="text-align: center; padding: 8px 0;">Qty</th>
              <th style="text-align: right; padding: 8px 0;">Price</th>
            </tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
        </table>
        <p style="font-size: 18px; font-weight: bold; margin-top: 16px;">
          Total: $${(order.total / 100).toFixed(2)}
        </p>
        <p>Production takes 2-5 business days. We'll email you tracking info once it ships.</p>
        <p style="color: #888; font-size: 12px; margin-top: 32px;">
          Order ref: ${order.sessionId.slice(-12)}
        </p>
      </div>
    `,
  });
}

export async function sendShippingNotification(
  to: string,
  order: { carrier: string; trackingNumber: string; trackingUrl: string },
) {
  const resend = getResend();
  if (!resend) return;

  await resend.emails.send({
    from: FROM,
    to,
    subject: "Your Gamerhood order has shipped!",
    html: `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
        <h1 style="color: #22d3ee;">Your order shipped!</h1>
        <p>Your custom merch is on its way. Here are the tracking details:</p>
        <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 0;"><strong>Carrier:</strong> ${order.carrier}</p>
          <p style="margin: 8px 0 0;"><strong>Tracking:</strong> ${order.trackingNumber}</p>
        </div>
        <p>
          <a href="${order.trackingUrl}"
             style="display: inline-block; background: #22d3ee; color: black; padding: 12px 24px;
                    border-radius: 8px; text-decoration: none; font-weight: bold;">
            Track Your Package
          </a>
        </p>
      </div>
    `,
  });
}

/**
 * Print-area drift alert — fires from the Stripe webhook when the pre-
 * payment safeguard detects a divergence between the cached print area
 * we used to render the preview and what Printful's catalog returns at
 * fulfillment time. Surfaces to every admin in `ADMIN_EMAILS` so somebody
 * can re-verify the variant in the Printful dashboard and either approve
 * the order or refund the buyer.
 *
 * Silently no-ops when `RESEND_API_KEY` or `ADMIN_EMAILS` is unset (e.g.
 * in dev). The `[print-area-drift]` console.error stays the canonical
 * record either way.
 */
export async function sendPrintAreaDriftAlert(data: {
  orderId: string | null;
  stripeSessionId: string;
  summary: string;
  details: string;
}) {
  const resend = getResend();
  if (!resend) return;
  const recipientsRaw = process.env.ADMIN_EMAILS ?? "";
  const recipients = recipientsRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (recipients.length === 0) return;

  await resend.emails
    .send({
      from: FROM,
      to: recipients,
      subject: `[print-area-drift] Order ${data.stripeSessionId.slice(-12)} held for review`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #ef4444;">Print-area drift detected</h1>
          <p>Pre-payment safeguard tripped on this order — automatic Printful
          submission was <strong>skipped</strong>. Verify the variant in the
          Printful catalog and either re-confirm the order or refund the
          buyer.</p>
          <table style="width: 100%; border-collapse: collapse; margin: 12px 0;">
            <tr>
              <td style="padding: 6px 0; color: #6b7280;">Stripe session</td>
              <td style="padding: 6px 0;"><code>${data.stripeSessionId}</code></td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #6b7280;">Internal order id</td>
              <td style="padding: 6px 0;"><code>${data.orderId ?? "—"}</code></td>
            </tr>
          </table>
          <h3 style="margin-top: 24px;">Summary</h3>
          <p>${data.summary}</p>
          <h3 style="margin-top: 24px;">Details</h3>
          <pre style="background: #f3f4f6; padding: 12px; border-radius: 6px; white-space: pre-wrap; font-size: 12px;">${data.details}</pre>
        </div>
      `,
    })
    .catch((err) => {
      console.warn("[print-area-drift] admin notify email failed:", err);
    });
}

export async function sendDmcaAcknowledgment(
  to: string,
  data: { contentUrl: string; description: string },
) {
  const resend = getResend();
  if (!resend) return;

  await resend.emails.send({
    from: FROM,
    to,
    subject: "DMCA Takedown Request Received — Gamerhood",
    html: `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
        <h1 style="color: #f97316;">DMCA Notice Received</h1>
        <p>We've received your DMCA takedown request regarding:</p>
        <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 0;"><strong>Content URL:</strong> ${data.contentUrl}</p>
          <p style="margin: 8px 0 0;"><strong>Description:</strong> ${data.description}</p>
        </div>
        <p>Our team will review this within 48 hours and take appropriate action in accordance with the DMCA.</p>
        <p style="color: #888; font-size: 12px; margin-top: 32px;">
          DMCA Agent: dmca@gamerhood.gg
        </p>
      </div>
    `,
  });
}
