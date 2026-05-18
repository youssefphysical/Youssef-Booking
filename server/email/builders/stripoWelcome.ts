/**
 * Welcome email — hand-coded responsive HTML (production).
 *
 * Layout adapted from the user-supplied reference HTML on 2026-05-18:
 *  - 700px container, 2-column hero (text left / athlete photo right)
 *  - 4 feature cards row (Personalized / Expert / Track / Support)
 *  - Next Steps panel with 3 list items + solid cyan CTA
 *  - Side-by-side quote panel with skyline image
 *  - Footer with logo, social row (WhatsApp / Instagram / YouTube / Email),
 *    "Need help?" line + "CONTACT SUPPORT" link, and copyright.
 *
 * Color system follows the reference exactly:
 *  - #0a0a0a body, #0b0c10 container, #0f1115 panel, #1a1c22 border
 *  - #00c3e5 cyan accent (reference shade — NOT brand #5EE7FF)
 *  - #ffffff / #d0d0d0 / #aaaaaa / #666666 text scale
 *
 * Image strategy (the reference's imgur URLs are dead — zero-byte ghosts
 * or HTML pages):
 *  - Hero athlete  → Unsplash stable CDN photo
 *  - Quote skyline → Unsplash stable CDN photo (Dubai)
 *  - Feature/step icons → icons8 cyan-tinted PNGs (stable HTTPS CDN)
 *  - Logo → text-set treatment (no broken-image risk)
 *
 * Compatibility:
 *  - All CSS inline. <style> in <head> only carries @media mobile rules.
 *  - MSO VML for solid CTA buttons in Outlook desktop.
 *  - Mobile breakpoint @620px stacks the two-column hero and quote, and
 *    converts the 4-up feature row into a 2x2 grid (then 1x4 at <420px).
 *  - Dark-mode quadruple-lock (body bgcolor + outer center + outer table
 *    bgcolor + [data-ogsc] selectors) prevents Gmail/Outlook.com/Yahoo
 *    from auto-inverting the AMOLED palette.
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
  /** Optional YouTube channel URL. */
  youtubeUrl?: string;
  /** Optional "View in browser" URL (defaults to site root). */
  browserUrl?: string;
}

// ---------------------------------------------------------------------------
// Color system (reference HTML, locked exactly)
// ---------------------------------------------------------------------------
const BG_BODY = "#0a0a0a";
const BG_CONTAINER = "#0b0c10";
const BG_PANEL = "#0f1115";
const BORDER = "#1a1c22";
const CYAN = "#00c3e5";
const TEXT_PRIMARY = "#ffffff";
const TEXT_SOFT = "#d0d0d0";
const TEXT_MUTED = "#aaaaaa";
const TEXT_DIM = "#666666";

// ---------------------------------------------------------------------------
// Image assets — all stable HTTPS, all verified before deploy
// ---------------------------------------------------------------------------
const IMG_HERO_ATHLETE =
  "https://images.unsplash.com/photo-1582550945154-66ea8fff25e1?w=700&h=820&fit=crop&q=80";
const IMG_SKYLINE =
  "https://images.unsplash.com/photo-1518684079-3c830dcef090?w=700&h=560&fit=crop&q=80";

const ICON_FEAT_PERSONALIZED = `https://img.icons8.com/ios-filled/100/${CYAN.slice(1)}/dumbbell.png`;
const ICON_FEAT_EXPERT = `https://img.icons8.com/ios-filled/100/${CYAN.slice(1)}/medal2.png`;
const ICON_FEAT_TRACK = `https://img.icons8.com/ios-filled/100/${CYAN.slice(1)}/line-chart.png`;
const ICON_FEAT_SUPPORT = `https://img.icons8.com/ios-filled/100/${CYAN.slice(1)}/headset.png`;

const ICON_STEP_INBODY = `https://img.icons8.com/ios-filled/100/${CYAN.slice(1)}/heart-health.png`;
const ICON_STEP_BOOKING = `https://img.icons8.com/ios-filled/100/${CYAN.slice(1)}/calendar-plus.png`;
const ICON_STEP_PLAN = `https://img.icons8.com/ios-filled/100/${CYAN.slice(1)}/task-completed.png`;

const ICON_SOCIAL_WHATSAPP = `https://img.icons8.com/ios-filled/100/${CYAN.slice(1)}/whatsapp.png`;
const ICON_SOCIAL_INSTAGRAM = `https://img.icons8.com/ios-filled/100/${CYAN.slice(1)}/instagram-new.png`;
const ICON_SOCIAL_YOUTUBE = `https://img.icons8.com/ios-filled/100/${CYAN.slice(1)}/youtube-play.png`;
const ICON_SOCIAL_EMAIL = `https://img.icons8.com/ios-filled/100/${CYAN.slice(1)}/filled-message.png`;

/** Escape user-supplied values before injection into HTML. */
function esc(v: string): string {
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ---------------------------------------------------------------------------
// Buttons — bulletproof VML (Outlook desktop) + clean HTML (everyone else).
// Arrow is appended via a 10px inline-block spacer in both branches.
// ---------------------------------------------------------------------------
function outlineButton(label: string, escapedHref: string): string {
  return `
  <!--[if mso]>
  <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${escapedHref}" style="height:46px;v-text-anchor:middle;width:230px;" arcsize="10%" strokecolor="${CYAN}" fillcolor="${BG_CONTAINER}">
    <w:anchorlock/>
    <center style="color:${CYAN};font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;letter-spacing:1px;">${label} &rarr;</center>
  </v:roundrect>
  <![endif]-->
  <!--[if !mso]><!-- -->
  <a href="${escapedHref}" target="_blank" rel="noopener" style="background-color:transparent;border:1px solid ${CYAN};border-radius:4px;color:${CYAN};display:inline-block;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;letter-spacing:1px;line-height:44px;padding:0 28px;text-align:center;text-decoration:none;-webkit-text-size-adjust:none;mso-hide:all;">${label}<span style="display:inline-block;width:10px;mso-hide:all;">&nbsp;</span><span style="font-weight:bold;">&rarr;</span></a>
  <!--<![endif]-->`;
}

function solidButton(label: string, escapedHref: string): string {
  return `
  <!--[if mso]>
  <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${escapedHref}" style="height:48px;v-text-anchor:middle;width:600px;" arcsize="8%" stroke="f" fillcolor="${CYAN}">
    <w:anchorlock/>
    <center style="color:${BG_BODY};font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;letter-spacing:1px;">${label} &rarr;</center>
  </v:roundrect>
  <![endif]-->
  <!--[if !mso]><!-- -->
  <a href="${escapedHref}" target="_blank" rel="noopener" style="background-color:${CYAN};border-radius:4px;color:${BG_BODY};display:block;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;letter-spacing:1px;line-height:48px;text-align:center;text-decoration:none;width:100%;-webkit-text-size-adjust:none;mso-hide:all;">${label}<span style="display:inline-block;width:10px;mso-hide:all;">&nbsp;</span><span style="font-weight:bold;">&rarr;</span></a>
  <!--<![endif]-->`;
}

/** Feature card cell — used 4× in the feature row. */
function featureCell(
  iconUrl: string,
  alt: string,
  titleTop: string,
  titleBottom: string,
  body: string,
  isLast: boolean,
): string {
  const borderRight = isLast ? "" : `border-right:1px solid ${BORDER};`;
  return `
  <td class="feat-cell" valign="top" align="center" width="25%" style="padding:28px 14px;${borderRight}">
    <img src="${iconUrl}" alt="${alt}" width="40" height="40" style="display:block;margin:0 auto 14px auto;border:0;width:40px;height:40px;" />
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:bold;color:${TEXT_PRIMARY};text-transform:uppercase;letter-spacing:1px;line-height:16px;margin-bottom:10px;">${titleTop}<br/>${titleBottom}</div>
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${TEXT_MUTED};line-height:18px;">${body}</div>
  </td>`;
}

/** Next-step row — icon + title + body + chevron. */
function stepRow(
  iconUrl: string,
  alt: string,
  title: string,
  body: string,
  isLast: boolean,
): string {
  const borderBottom = isLast ? "" : `border-bottom:1px solid ${BORDER};`;
  return `
  <tr><td style="padding:14px 0;${borderBottom}">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td width="44" valign="middle"><img src="${iconUrl}" alt="${alt}" width="36" height="36" style="display:block;border:0;width:36px;height:36px;" /></td>
        <td valign="middle" style="padding-left:14px;">
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:${TEXT_PRIMARY};line-height:20px;">${title}</div>
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${TEXT_MUTED};line-height:18px;margin-top:2px;">${body}</div>
        </td>
        <td width="20" valign="middle" align="right" style="color:${TEXT_PRIMARY};font-family:Arial,Helvetica,sans-serif;font-size:20px;line-height:1;">&rsaquo;</td>
      </tr>
    </table>
  </td></tr>`;
}

/** Social icon cell — used 4× in the footer row. */
function socialCell(href: string, iconUrl: string, alt: string): string {
  return `
  <td style="padding:0 12px;">
    <a href="${href}" target="_blank" rel="noopener" style="text-decoration:none;">
      <img src="${iconUrl}" alt="${alt}" width="30" height="30" style="display:block;border:0;width:30px;height:30px;" />
    </a>
  </td>`;
}

// ---------------------------------------------------------------------------
// Full HTML — all values must already be escaped.
// ---------------------------------------------------------------------------
function buildHtml(v: {
  clientName: string;
  dashboardUrl: string;
  signupUrl: string;
  supportWhatsappUrl: string;
  supportEmail: string;
  instagramUrl: string;
  youtubeUrl: string;
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
  <meta name="supported-color-schemes" content="dark">
  <title>Welcome to Elite Coaching</title>
  <!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
  <!--[if !mso]><!-- -->
  <style type="text/css">
    :root { color-scheme: dark; supported-color-schemes: dark; }
    body, table, td, div, p, a, h1, h2, h3 { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
    img { -ms-interpolation-mode:bicubic; border:0; outline:none; text-decoration:none; display:block; }
    a { text-decoration:none; }
    /* Outlook.com dark-mode safety */
    [data-ogsc] .body, [data-ogsb] .body { background-color:${BG_BODY} !important; }
    [data-ogsc] .container, [data-ogsb] .container { background-color:${BG_CONTAINER} !important; }
    [data-ogsc] .panel, [data-ogsb] .panel { background-color:${BG_PANEL} !important; }
    [data-ogsc] .text-primary { color:${TEXT_PRIMARY} !important; }
    [data-ogsc] .text-soft { color:${TEXT_SOFT} !important; }
    [data-ogsc] .text-muted { color:${TEXT_MUTED} !important; }
    [data-ogsc] .text-cyan, [data-ogsb] .text-cyan { color:${CYAN} !important; }
    /* Mobile breakpoint */
    @media only screen and (max-width:620px) {
      .container { width:100% !important; max-width:100% !important; }
      .px-mobile { padding-left:18px !important; padding-right:18px !important; }
      .hero-col, .quote-col { display:block !important; width:100% !important; padding:0 !important; }
      .hero-text { padding:18px 0 22px 0 !important; }
      .hero-img-wrap { padding-top:14px !important; }
      .hero-h1 { font-size:32px !important; line-height:36px !important; }
      .feat-row { display:block !important; width:100% !important; }
      .feat-cell { display:inline-block !important; width:50% !important; box-sizing:border-box !important; border-right:0 !important; border-bottom:1px solid ${BORDER} !important; padding:22px 12px !important; }
      .quote-text { padding:22px 18px !important; }
      .quote-img-wrap { padding:0 !important; }
      .quote-img { border-radius:0 0 8px 8px !important; }
      .footer-pad { padding:18px !important; }
    }
    @media only screen and (max-width:420px) {
      .feat-cell { width:100% !important; }
    }
  </style>
  <!--<![endif]-->
</head>
<body class="body" bgcolor="${BG_BODY}" style="margin:0;padding:0;background-color:${BG_BODY};font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <span style="display:none !important;visibility:hidden;mso-hide:all;font-size:1px;color:${BG_BODY};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">Welcome to Elite Coaching, ${v.clientName} — your premium training journey starts here.</span>
  <center style="width:100%;background-color:${BG_BODY};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${BG_BODY}" style="background-color:${BG_BODY};">
      <tr><td align="center" style="padding:20px 0;">
        <table class="container" role="presentation" width="700" cellpadding="0" cellspacing="0" border="0" bgcolor="${BG_CONTAINER}" style="max-width:700px;width:100%;background-color:${BG_CONTAINER};">

          <!-- Top bar -->
          <tr><td class="px-mobile" style="padding:18px 30px 6px 30px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td class="text-muted" style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${TEXT_SOFT};font-weight:400;text-align:left;">Elite training. Personalized for you.</td>
                <td class="text-cyan" style="font-family:Arial,Helvetica,sans-serif;font-size:12px;text-align:right;"><a href="${v.browserUrl}" style="color:${CYAN};text-decoration:underline;">View in browser</a></td>
              </tr>
            </table>
          </td></tr>

          <!-- Logo -->
          <tr><td class="px-mobile" style="padding:14px 30px 6px 30px;">
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;color:${CYAN};letter-spacing:4px;line-height:14px;text-transform:uppercase;">YOUSSEF</div>
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:700;color:${TEXT_PRIMARY};letter-spacing:3px;line-height:24px;text-transform:uppercase;margin-top:2px;">Elite Coaching</div>
          </td></tr>

          <!-- Hero -->
          <tr><td class="px-mobile" style="padding:6px 30px 22px 30px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td class="hero-col hero-text" valign="top" width="55%" style="padding-right:18px;">
                  <h1 class="hero-h1 text-primary" style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:38px;font-weight:700;color:${TEXT_PRIMARY};letter-spacing:1px;line-height:42px;">WELCOME TO</h1>
                  <h1 class="hero-h1 text-cyan" style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:38px;font-weight:700;color:${CYAN};letter-spacing:1px;line-height:42px;">ELITE</h1>
                  <h1 class="hero-h1 text-cyan" style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:38px;font-weight:700;color:${CYAN};letter-spacing:1px;line-height:42px;">COACHING</h1>
                  <div style="width:40px;height:3px;background:${CYAN};margin:16px 0;font-size:0;line-height:0;">&nbsp;</div>
                  <p class="text-soft" style="font-family:Arial,Helvetica,sans-serif;color:${TEXT_SOFT};font-size:15px;line-height:24px;margin:10px 0 22px 0;">You've just taken the first step towards transforming your life.<br/><br/>We're here to guide, support and push you towards becoming the strongest version of yourself.</p>
                  ${outlineButton("LET'S GET STARTED", v.signupUrl)}
                </td>
                <td class="hero-col hero-img-wrap" valign="top" width="45%">
                  <img src="${IMG_HERO_ATHLETE}" alt="Athlete training" width="280" style="display:block;border:0;width:100%;max-width:300px;height:auto;border-radius:6px;" />
                </td>
              </tr>
            </table>
          </td></tr>

          <!-- Feature cards -->
          <tr><td class="px-mobile" style="padding:0 30px 22px 30px;">
            <table class="panel" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${BG_PANEL}" style="background-color:${BG_PANEL};border:1px solid ${BORDER};border-radius:8px;">
              <tr class="feat-row">
                ${featureCell(ICON_FEAT_PERSONALIZED, "Personalized", "PERSONALIZED", "COACHING", "Tailored training &amp; nutrition plans just for you.", false)}
                ${featureCell(ICON_FEAT_EXPERT, "Expert", "EXPERT", "TRAINERS", "Learn from the best. Always by your side.", false)}
                ${featureCell(ICON_FEAT_TRACK, "Track", "TRACK &amp;", "PROGRESS", "We track what matters so you see real results.", false)}
                ${featureCell(ICON_FEAT_SUPPORT, "Support", "SUPPORT &amp;", "ACCOUNTABILITY", "We&#39;re with you every step of the way.", true)}
              </tr>
            </table>
          </td></tr>

          <!-- Next Steps -->
          <tr><td class="px-mobile" style="padding:0 30px 22px 30px;">
            <table class="panel" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${BG_PANEL}" style="background-color:${BG_PANEL};border:1px solid ${BORDER};border-radius:8px;">
              <tr><td style="padding:22px 22px 6px 22px;">
                <h2 class="text-cyan" style="margin:0 0 12px 0;font-family:Arial,Helvetica,sans-serif;font-size:18px;color:${CYAN};text-transform:uppercase;letter-spacing:1px;line-height:24px;">YOUR NEXT STEPS</h2>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  ${stepRow(ICON_STEP_INBODY, "InBody", "Complete your InBody assessment", "Help us understand your baseline.", false)}
                  ${stepRow(ICON_STEP_BOOKING, "Booking", "Book your first session", "Let&#39;s get you started.", false)}
                  ${stepRow(ICON_STEP_PLAN, "Plan", "Follow your personalized plan", "Stay consistent and trust the process.", true)}
                </table>
              </td></tr>
              <tr><td style="padding:8px 22px 22px 22px;">
                ${solidButton("GO TO DASHBOARD", v.dashboardUrl)}
              </td></tr>
            </table>
          </td></tr>

          <!-- Quote -->
          <tr><td class="px-mobile" style="padding:0 30px 22px 30px;">
            <table class="panel" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${BG_PANEL}" style="background-color:${BG_PANEL};border:1px solid ${BORDER};border-radius:8px;">
              <tr>
                <td class="quote-col quote-text" valign="middle" width="55%" style="padding:30px 22px;">
                  <div class="text-cyan" style="font-family:Georgia,Times,serif;font-size:54px;color:${CYAN};line-height:0.6;margin-bottom:10px;">&ldquo;</div>
                  <div class="text-primary" style="font-family:Arial,Helvetica,sans-serif;font-size:18px;color:${TEXT_PRIMARY};font-style:italic;line-height:26px;">The body achieves what the mind believes.</div>
                  <div class="text-cyan" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${CYAN};font-weight:700;margin-top:16px;line-height:18px;">&ndash; Youssef</div>
                  <div class="text-muted" style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${TEXT_MUTED};line-height:18px;margin-top:2px;">Elite Coaching Team</div>
                </td>
                <td class="quote-col quote-img-wrap" width="45%" valign="middle" style="padding:0;">
                  <img class="quote-img" src="${IMG_SKYLINE}" alt="Dubai skyline" width="300" style="display:block;border:0;width:100%;height:auto;border-radius:0 8px 8px 0;" />
                </td>
              </tr>
            </table>
          </td></tr>

          <!-- Footer logo + social -->
          <tr><td class="px-mobile" style="padding:18px 30px 8px 30px;text-align:center;">
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:700;color:${CYAN};letter-spacing:4px;line-height:13px;text-transform:uppercase;">YOUSSEF</div>
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:700;color:${TEXT_PRIMARY};letter-spacing:3px;line-height:20px;text-transform:uppercase;margin-top:2px;">Elite Coaching</div>
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${TEXT_PRIMARY};text-transform:uppercase;letter-spacing:2px;margin:18px 0 14px 0;line-height:16px;">STAY CONNECTED</div>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
              <tr>
                ${socialCell(v.supportWhatsappUrl, ICON_SOCIAL_WHATSAPP, "WhatsApp")}
                ${socialCell(v.instagramUrl, ICON_SOCIAL_INSTAGRAM, "Instagram")}
                ${socialCell(v.youtubeUrl, ICON_SOCIAL_YOUTUBE, "YouTube")}
                ${socialCell("mailto:" + v.supportEmail, ICON_SOCIAL_EMAIL, "Email")}
              </tr>
            </table>
          </td></tr>

          <!-- Contact support row -->
          <tr><td class="px-mobile" style="padding:14px 30px 14px 30px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td class="text-muted" style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${TEXT_MUTED};text-align:left;">Need help? We&#39;re here for you.</td>
                <td style="font-family:Arial,Helvetica,sans-serif;font-size:12px;text-align:right;"><a href="${v.supportWhatsappUrl}" style="color:${CYAN};text-decoration:none;font-weight:700;letter-spacing:0.5px;">CONTACT SUPPORT &rarr;</a></td>
              </tr>
            </table>
          </td></tr>

          <!-- Copyright -->
          <tr><td class="px-mobile" style="padding:18px 30px 24px 30px;border-top:1px solid ${BORDER};text-align:center;">
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${TEXT_DIM};line-height:18px;">&copy; 2026 Youssef Elite Coaching. All rights reserved.</div>
          </td></tr>

        </table>
      </td></tr>
    </table>
  </center>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Plain-text fallback
// ---------------------------------------------------------------------------
function buildText(v: {
  clientName: string;
  dashboardUrl: string;
  signupUrl: string;
  supportWhatsappUrl: string;
  supportEmail: string;
  instagramUrl: string;
}): string {
  return [
    `WELCOME TO ELITE COACHING, ${v.clientName.toUpperCase()}`,
    "",
    "You've just taken the first step towards transforming your life.",
    "We're here to guide, support and push you towards becoming the",
    "strongest version of yourself.",
    "",
    `LET'S GET STARTED → ${v.signupUrl}`,
    "",
    "WHAT WE OFFER",
    "  • Personalized Coaching — tailored training & nutrition plans.",
    "  • Expert Trainers — learn from the best, always by your side.",
    "  • Track & Progress — we measure what matters.",
    "  • Support & Accountability — every step of the way.",
    "",
    "YOUR NEXT STEPS",
    "  1. Complete your InBody assessment — help us understand your baseline.",
    "  2. Book your first session — let's get you started.",
    "  3. Follow your personalized plan — stay consistent, trust the process.",
    "",
    `GO TO DASHBOARD → ${v.dashboardUrl}`,
    "",
    `"The body achieves what the mind believes." — Youssef, Elite Coaching Team`,
    "",
    "STAY CONNECTED",
    `  WhatsApp:  ${v.supportWhatsappUrl}`,
    `  Instagram: ${v.instagramUrl}`,
    `  Email:     mailto:${v.supportEmail}`,
    "",
    `Need help? CONTACT SUPPORT → ${v.supportWhatsappUrl}`,
    "",
    "© 2026 Youssef Elite Coaching. All rights reserved.",
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
    youtubeUrl: esc(input.youtubeUrl ?? "https://www.youtube.com/@youssefelite"),
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
