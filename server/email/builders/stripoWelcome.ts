/**
 * Welcome email — hand-coded responsive HTML (production).
 *
 * Visually matches the original Stripo composition (AMOLED black,
 * Tron-cyan accents, hero photo, Next Steps cards, quote, social row,
 * Contact Support CTA, footer) but ships as REAL responsive HTML so
 * every button and icon is individually clickable, text is selectable
 * and screen-reader-accessible, and the layout scales correctly on
 * mobile Gmail.
 *
 * Email-client compatibility strategy:
 *  - Outer 100% table + inner 600px fixed table (the bulletproof
 *    pattern that works in Outlook 2007+, Gmail, Apple Mail, Yahoo).
 *  - All CSS is INLINE on each element — Gmail strips <style> blocks.
 *    A tiny <style> in <head> only carries the @media mobile overrides
 *    (Gmail honours these for mobile breakpoints).
 *  - MSO conditional comments give Outlook a VML-rendered button
 *    background so the cyan CTAs are not just blue underlined text.
 *  - Web-safe font stack only (Arial / Helvetica / sans-serif) — no
 *    Google Fonts (Outlook + Yahoo silently drop them).
 *  - Social icons are PNGs from img.icons8.com tinted to the brand
 *    cyan (#5EE7FF) — known-stable CDN, served over HTTPS.
 *  - Hero photo reuses the existing Stripo CDN asset to preserve
 *    visual fidelity with the prior design.
 *  - Hidden preheader controls the inbox preview line.
 */

import type { ComposedEmail } from "../composer";

export interface StripoWelcomeInput {
  clientName: string;
  /** Dashboard URL for the "GO TO DASHBOARD" CTA. */
  dashboardUrl: string;
  /** WhatsApp URL for the icon + "CONTACT SUPPORT" CTA. */
  supportWhatsappUrl: string;
  /** Email address used by the envelope icon's mailto: link. */
  supportEmail: string;
  /** Optional inbox subject override. */
  subject?: string;
  /** Optional override for the "LET'S GET STARTED" CTA. */
  signupUrl?: string;
  /** Optional Instagram profile URL. */
  instagramUrl?: string;
  /** Optional "View in browser" URL (defaults to site root). */
  browserUrl?: string;
}

// ---------------------------------------------------------------------------
// Brand constants — match the AMOLED + Tron-cyan system used app-wide.
// ---------------------------------------------------------------------------
const BG_DEEP = "#05070B"; // page background
const BG_PANEL = "#0B0F16"; // card / inner section background
const BORDER_CYAN = "#5EE7FF"; // primary accent (Tron cyan)
const TEXT_PRIMARY = "#F5F7FA";
const TEXT_MUTED = "#9AA3B2";
const TEXT_DIM = "#5C6675";
const HERO_IMG =
  "https://fzwnnfo.stripocdn.email/content/guids/CABINET_8f26cfc048e4c09e860a0c1ef3b52f0fd15f259882f5a8bb81672ae0c64c8581/images/file_00000000f94c720a804187d0067a77a3.png";

// Brand-tinted social icons (img.icons8.com — stable HTTPS CDN, works
// in every major mail client). Tint color matches BORDER_CYAN.
const ICON_INSTAGRAM =
  "https://img.icons8.com/ios-filled/100/5EE7FF/instagram-new.png";
const ICON_WHATSAPP =
  "https://img.icons8.com/ios-filled/100/5EE7FF/whatsapp.png";
const ICON_EMAIL =
  "https://img.icons8.com/ios-filled/100/5EE7FF/filled-message.png";

/** Escape user-supplied values before injection into HTML. */
function esc(v: string): string {
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Bulletproof button — table + MSO VML so it renders as a solid
 * cyan pill in every client (including Outlook 2007–2019 desktop).
 */
function ctaButton(label: string, href: string): string {
  const safeHref = esc(href);
  const safeLabel = esc(label);
  // VML width/height tuned for the 600px container; height 50 keeps
  // tap-target ≥ 44pt on iOS (Apple HIG).
  return `
  <!--[if mso]>
  <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${safeHref}" style="height:50px;v-text-anchor:middle;width:280px;" arcsize="60%" stroke="f" fillcolor="${BORDER_CYAN}">
    <w:anchorlock/>
    <center style="color:#05070B;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;letter-spacing:1px;">${safeLabel}</center>
  </v:roundrect>
  <![endif]-->
  <!--[if !mso]><!-- -->
  <a href="${safeHref}" target="_blank" rel="noopener" style="background-color:${BORDER_CYAN};border-radius:30px;color:#05070B;display:inline-block;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;letter-spacing:1.5px;line-height:50px;text-align:center;text-decoration:none;width:280px;-webkit-text-size-adjust:none;mso-hide:all;">${safeLabel}</a>
  <!--<![endif]-->`;
}

/** Secondary outline button (cyan border, transparent fill). */
function outlineButton(label: string, href: string): string {
  const safeHref = esc(href);
  const safeLabel = esc(label);
  return `
  <!--[if mso]>
  <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${safeHref}" style="height:48px;v-text-anchor:middle;width:260px;" arcsize="60%" strokecolor="${BORDER_CYAN}" fillcolor="${BG_DEEP}">
    <w:anchorlock/>
    <center style="color:${BORDER_CYAN};font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;letter-spacing:1px;">${safeLabel}</center>
  </v:roundrect>
  <![endif]-->
  <!--[if !mso]><!-- -->
  <a href="${safeHref}" target="_blank" rel="noopener" style="background-color:${BG_DEEP};border:2px solid ${BORDER_CYAN};border-radius:28px;color:${BORDER_CYAN};display:inline-block;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;letter-spacing:1.5px;line-height:44px;text-align:center;text-decoration:none;width:256px;-webkit-text-size-adjust:none;mso-hide:all;">${safeLabel}</a>
  <!--<![endif]-->`;
}

/** A single "Next Steps" card row. */
function nextStepCard(num: string, title: string, body: string): string {
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${BG_PANEL};border:1px solid #1A2230;border-radius:8px;margin:0 0 12px 0;">
    <tr>
      <td valign="top" align="center" width="60" style="padding:18px 0 18px 18px;">
        <div style="width:38px;height:38px;line-height:38px;border-radius:50%;background-color:${BG_DEEP};border:1.5px solid ${BORDER_CYAN};color:${BORDER_CYAN};font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;text-align:center;">${num}</div>
      </td>
      <td valign="top" style="padding:16px 18px 18px 14px;">
        <div style="color:${TEXT_PRIMARY};font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;letter-spacing:0.3px;margin:0 0 4px 0;">${title}</div>
        <div style="color:${TEXT_MUTED};font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;">${body}</div>
      </td>
    </tr>
  </table>`;
}

/** Build the full HTML body. All values must already be escaped. */
function buildHtml(v: {
  clientName: string;
  dashboardUrl: string;
  signupUrl: string;
  supportWhatsappUrl: string;
  supportEmail: string;
  instagramUrl: string;
  browserUrl: string;
}): string {
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html dir="ltr" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office" lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="format-detection" content="telephone=no, address=no, email=no, date=no">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark light">
  <title>Welcome to Youssef Elite Coaching</title>
  <!--[if gte mso 9]>
  <xml>
    <o:OfficeDocumentSettings>
      <o:AllowPNG/>
      <o:PixelsPerInch>96</o:PixelsPerInch>
    </o:OfficeDocumentSettings>
  </xml>
  <![endif]-->
  <style type="text/css">
    /* Mobile overrides — Gmail strips most <style>, but honours @media. */
    @media only screen and (max-width:620px) {
      .container { width:100% !important; }
      .px { padding-left:20px !important; padding-right:20px !important; }
      .h1 { font-size:28px !important; line-height:34px !important; }
      .h2 { font-size:18px !important; line-height:24px !important; }
      .hero { width:100% !important; height:auto !important; }
      .cta, .cta2 { width:100% !important; max-width:320px !important; }
      .stack td { display:block !important; width:100% !important; padding:0 0 12px 0 !important; text-align:center !important; }
      .stack .num { margin:0 auto !important; }
    }
    /* Outlook.com / Yahoo dark-bg fix */
    body, table, td, a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
    table, td { mso-table-lspace:0pt; mso-table-rspace:0pt; }
    img { -ms-interpolation-mode:bicubic; border:0; outline:none; text-decoration:none; }
    a { text-decoration:none; }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${BG_DEEP};color:${TEXT_PRIMARY};font-family:Arial,Helvetica,sans-serif;">
  <!-- Preheader (inbox preview line; invisible in body) -->
  <div style="display:none;font-size:1px;color:${BG_DEEP};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">
    ${v.clientName}, welcome to Elite Coaching — your transformation starts now.
  </div>

  <!-- 100% outer wrapper for the dark background -->
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${BG_DEEP};">
    <tr>
      <td align="center" style="padding:0;">

        <!-- View in browser bar -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="container" style="width:600px;max-width:600px;">
          <tr>
            <td align="right" class="px" style="padding:14px 24px 0 24px;color:${TEXT_DIM};font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:0.5px;">
              <a href="${v.browserUrl}" target="_blank" rel="noopener" style="color:${TEXT_DIM};text-decoration:underline;">View in browser</a>
            </td>
          </tr>
        </table>

        <!-- Logo / brand header -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="container" style="width:600px;max-width:600px;">
          <tr>
            <td align="center" class="px" style="padding:20px 24px 8px 24px;">
              <div style="color:${BORDER_CYAN};font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:bold;letter-spacing:6px;text-transform:uppercase;">Youssef Elite Coaching</div>
              <div style="height:2px;width:48px;background-color:${BORDER_CYAN};margin:10px auto 0;line-height:2px;font-size:0;">&nbsp;</div>
            </td>
          </tr>
        </table>

        <!-- Hero image (real <img>, click-through to dashboard) -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="container" style="width:600px;max-width:600px;">
          <tr>
            <td align="center" class="px" style="padding:16px 24px 0 24px;">
              <a href="${v.dashboardUrl}" target="_blank" rel="noopener" style="text-decoration:none;display:block;">
                <img src="${HERO_IMG}" alt="Welcome to Elite Coaching" width="552" class="hero" style="display:block;width:100%;max-width:552px;height:auto;border-radius:10px;border:0;outline:none;text-decoration:none;">
              </a>
            </td>
          </tr>
        </table>

        <!-- Welcome heading + intro -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="container" style="width:600px;max-width:600px;">
          <tr>
            <td align="center" class="px" style="padding:32px 32px 0 32px;">
              <div class="h1" style="color:${TEXT_PRIMARY};font-family:Arial,Helvetica,sans-serif;font-size:32px;font-weight:bold;line-height:38px;letter-spacing:0.5px;margin:0;">
                Welcome, ${v.clientName}.
              </div>
              <div style="color:${BORDER_CYAN};font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;letter-spacing:3px;text-transform:uppercase;margin:14px 0 0 0;">
                Your transformation starts now
              </div>
              <p style="color:${TEXT_MUTED};font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:24px;margin:18px 0 0 0;">
                You've just joined an elite circle of clients who refuse to settle for ordinary.
                Over the coming weeks, we'll build the strongest, leanest, most disciplined
                version of you — one session at a time.
              </p>
            </td>
          </tr>
        </table>

        <!-- Primary CTA -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="container" style="width:600px;max-width:600px;">
          <tr>
            <td align="center" style="padding:28px 24px 8px 24px;">
              ${ctaButton("LET'S GET STARTED", v.signupUrl)}
            </td>
          </tr>
        </table>

        <!-- Your Next Steps section -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="container" style="width:600px;max-width:600px;">
          <tr>
            <td class="px" style="padding:36px 24px 0 24px;">
              <div class="h2" style="color:${TEXT_PRIMARY};font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:bold;letter-spacing:0.5px;text-align:center;margin:0 0 6px 0;">
                Your Next Steps
              </div>
              <div style="color:${TEXT_DIM};font-family:Arial,Helvetica,sans-serif;font-size:12px;letter-spacing:2px;text-transform:uppercase;text-align:center;margin:0 0 20px 0;">
                A clear path forward
              </div>
              ${nextStepCard("01", "Complete your profile", "Add your goals, training level, and a profile photo so we can personalise every session.")}
              ${nextStepCard("02", "Book your first session", "Pick a slot that fits your schedule. Real-time availability — no back-and-forth.")}
              ${nextStepCard("03", "Track your progress", "InBody scans, photos, and check-ins all live in one dashboard. We measure what matters.")}
            </td>
          </tr>
        </table>

        <!-- Secondary CTA -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="container" style="width:600px;max-width:600px;">
          <tr>
            <td align="center" style="padding:8px 24px 0 24px;">
              ${outlineButton("GO TO DASHBOARD", v.dashboardUrl)}
            </td>
          </tr>
        </table>

        <!-- Quote section -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="container" style="width:600px;max-width:600px;">
          <tr>
            <td class="px" style="padding:40px 32px 0 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${BG_PANEL};border-left:3px solid ${BORDER_CYAN};border-radius:6px;">
                <tr>
                  <td style="padding:24px 28px;">
                    <div style="color:${TEXT_PRIMARY};font-family:Georgia,'Times New Roman',serif;font-size:18px;font-style:italic;line-height:28px;">
                      "Discipline is the bridge between goals and accomplishment."
                    </div>
                    <div style="color:${TEXT_DIM};font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;margin-top:14px;">
                      — Coach Youssef
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- Social icons row -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="container" style="width:600px;max-width:600px;">
          <tr>
            <td align="center" style="padding:40px 24px 0 24px;">
              <div style="color:${TEXT_DIM};font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:3px;text-transform:uppercase;margin-bottom:14px;">
                Stay Connected
              </div>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
                <tr>
                  <td align="center" style="padding:0 12px;">
                    <a href="${v.instagramUrl}" target="_blank" rel="noopener" style="text-decoration:none;">
                      <img src="${ICON_INSTAGRAM}" alt="Instagram" width="28" height="28" style="display:block;border:0;outline:none;width:28px;height:28px;">
                    </a>
                  </td>
                  <td align="center" style="padding:0 12px;">
                    <a href="${v.supportWhatsappUrl}" target="_blank" rel="noopener" style="text-decoration:none;">
                      <img src="${ICON_WHATSAPP}" alt="WhatsApp" width="28" height="28" style="display:block;border:0;outline:none;width:28px;height:28px;">
                    </a>
                  </td>
                  <td align="center" style="padding:0 12px;">
                    <a href="mailto:${v.supportEmail}" target="_blank" rel="noopener" style="text-decoration:none;">
                      <img src="${ICON_EMAIL}" alt="Email" width="28" height="28" style="display:block;border:0;outline:none;width:28px;height:28px;">
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- Contact Support CTA -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="container" style="width:600px;max-width:600px;">
          <tr>
            <td align="center" style="padding:24px 24px 0 24px;">
              ${outlineButton("CONTACT SUPPORT", v.supportWhatsappUrl)}
            </td>
          </tr>
        </table>

        <!-- Footer -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="container" style="width:600px;max-width:600px;">
          <tr>
            <td align="center" class="px" style="padding:36px 32px 36px 32px;">
              <div style="color:${TEXT_DIM};font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:18px;letter-spacing:0.5px;">
                Youssef Elite Coaching · Dubai, United Arab Emirates<br>
                You're receiving this because you created an account at
                <a href="${v.browserUrl}" target="_blank" rel="noopener" style="color:${TEXT_MUTED};text-decoration:underline;">youssefelite.com</a>.
              </div>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Plain-text fallback (Gmail "View original" / text-only clients). */
function buildText(v: {
  clientName: string;
  dashboardUrl: string;
  signupUrl: string;
  supportWhatsappUrl: string;
  supportEmail: string;
  instagramUrl: string;
}): string {
  return [
    `Welcome, ${v.clientName}.`,
    "",
    "YOUR TRANSFORMATION STARTS NOW",
    "",
    "You've just joined an elite circle of clients who refuse to settle",
    "for ordinary. Over the coming weeks, we'll build the strongest,",
    "leanest, most disciplined version of you — one session at a time.",
    "",
    `LET'S GET STARTED → ${v.signupUrl}`,
    "",
    "YOUR NEXT STEPS",
    "",
    "01. Complete your profile",
    "    Add your goals, training level, and a profile photo so we can",
    "    personalise every session.",
    "",
    "02. Book your first session",
    "    Pick a slot that fits your schedule. Real-time availability.",
    "",
    "03. Track your progress",
    "    InBody scans, photos, and check-ins in one dashboard.",
    "",
    `GO TO DASHBOARD → ${v.dashboardUrl}`,
    "",
    `"Discipline is the bridge between goals and accomplishment."`,
    "  — Coach Youssef",
    "",
    "STAY CONNECTED",
    `  Instagram: ${v.instagramUrl}`,
    `  WhatsApp:  ${v.supportWhatsappUrl}`,
    `  Email:     mailto:${v.supportEmail}`,
    "",
    `CONTACT SUPPORT → ${v.supportWhatsappUrl}`,
    "",
    "Youssef Elite Coaching · Dubai, United Arab Emirates",
  ].join("\n");
}

export function buildStripoWelcomeEmail(input: StripoWelcomeInput): ComposedEmail {
  const v = {
    clientName: esc(input.clientName),
    dashboardUrl: esc(input.dashboardUrl),
    signupUrl: esc(input.signupUrl ?? "https://www.youssefelite.com/sign-up"),
    supportWhatsappUrl: esc(input.supportWhatsappUrl),
    supportEmail: esc(input.supportEmail),
    instagramUrl: esc(input.instagramUrl ?? "https://instagram.com/youssef.fitness"),
    browserUrl: esc(input.browserUrl ?? "https://www.youssefelite.com"),
  };

  const html = buildHtml(v);
  const subject = input.subject ?? `Welcome to Elite Coaching, ${input.clientName}`;
  const text = buildText({
    clientName: input.clientName,
    dashboardUrl: input.dashboardUrl,
    signupUrl: input.signupUrl ?? "https://www.youssefelite.com/sign-up",
    supportWhatsappUrl: input.supportWhatsappUrl,
    supportEmail: input.supportEmail,
    instagramUrl: input.instagramUrl ?? "https://instagram.com/youssef.fitness",
  });

  return { subject, html, text };
}
