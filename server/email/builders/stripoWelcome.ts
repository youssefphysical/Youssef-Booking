/**
 * Welcome email — Stripo export (production).
 *
 * The HTML was designed in Stripo and exported as a single full-bleed
 * image composition. We preserve the exported markup byte-for-byte
 * (head, MSO conditionals, media queries, table structure, image src,
 * dimensions, classes) and only inject four runtime tokens:
 *
 *   {{client_name}}          → hidden preheader (Gmail/Apple inbox
 *                              preview line, invisible in body — does
 *                              NOT alter the Stripo design).
 *   {{dashboard_url}}        → wraps the hero image in an <a> so the
 *                              all-image email has a working CTA.
 *   {{support_whatsapp_url}} → hidden support block at the very bottom
 *   {{support_email}}          (visible only to screen readers and
 *                              text-only clients; not rendered in any
 *                              visual email client).
 *
 * The exported HTML has no visible text slots, so these are the only
 * safe injection points that honour the user's "do NOT redesign"
 * requirement. The visible composition remains the Stripo PNG exactly.
 */

import type { ComposedEmail } from "../composer";

export interface StripoWelcomeInput {
  clientName: string;
  dashboardUrl: string;
  supportWhatsappUrl: string;
  supportEmail: string;
  /** Optional inbox subject override. Defaults to the EN welcome line. */
  subject?: string;
}

/**
 * Verbatim Stripo export. Two tiny transforms vs. the original:
 *  1. <img …> is wrapped in <a href="{{dashboard_url}}" …> (the
 *     all-image email's only sensible CTA).
 *  2. A hidden preheader DIV (first child of <body>) shows
 *     "{{client_name}}, welcome to Elite Coaching" in inbox previews.
 *  3. A hidden support contact block sits at the end of <body> so the
 *     accessibility / text-only fallback exposes all four tokens.
 * Nothing else is touched — head, styles, MSO blocks, table widths,
 * image URL, classes, attributes are all the original Stripo export.
 */
const TEMPLATE_HTML = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html dir="ltr" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office" lang="en">
 <head>
  <meta charset="UTF-8">
  <meta content="width=device-width, initial-scale=1" name="viewport">
  <meta name="x-apple-disable-message-reformatting">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta content="telephone=no" name="format-detection">
  <title>Welcome to Elite Coaching</title><!--[if (mso 16)]>
    <style type="text/css">
    a {text-decoration: none;}
    </style>
    <![endif]--><!--[if gte mso 9]><style>sup { font-size: 100% !important; }</style><![endif]--><!--[if gte mso 9]>
<noscript>
         <xml>
           <o:OfficeDocumentSettings>
           <o:AllowPNG></o:AllowPNG>
           <o:PixelsPerInch>96</o:PixelsPerInch>
           </o:OfficeDocumentSettings>
         </xml>
      </noscript>
<![endif]--><!--[if mso]><xml>
    <w:WordDocument xmlns:w="urn:schemas-microsoft-com:office:word">
      <w:DontUseAdvancedTypographyReadingMail/>
    </w:WordDocument>
    </xml><![endif]-->
  <style type="text/css">
.rollover:hover .rollover-first {
  max-height:0px!important;
  display:none!important;
}
.rollover:hover .rollover-second {
  max-height:none!important;
  display:block!important;
}
.rollover span {
  font-size:0px;
}
u + .body img ~ div div {
  display:none;
}
#outlook a {
  padding:0;
}
span.MsoHyperlink,
span.MsoHyperlinkFollowed {
  color:inherit;
  mso-style-priority:99;
}
a.es-button {
  mso-style-priority:100!important;
  text-decoration:none!important;
}
a[x-apple-data-detectors],
#MessageViewBody a {
  color:inherit!important;
  text-decoration:none!important;
  font-size:inherit!important;
  font-family:inherit!important;
  font-weight:inherit!important;
  line-height:inherit!important;
}
.es-desk-hidden {
  display:none;
  float:left;
  overflow:hidden;
  width:0;
  max-height:0;
  line-height:0;
  mso-hide:all;
}
@media only screen and (max-width:600px) {.es-m-p20b { padding-bottom:20px!important } .es-p-default { padding-top:20px!important; padding-left:20px!important } *[class="gmail-fix"] { display:none!important } p, a { line-height:150%!important } h1, h1 a { line-height:120%!important } h2, h2 a { line-height:120%!important } h3, h3 a { line-height:120%!important } h4, h4 a { line-height:120%!important } h5, h5 a { line-height:120%!important } h6, h6 a { line-height:120%!important } h1 { font-size:40px!important; text-align:left } h2 { font-size:32px!important; text-align:left } h3 { font-size:28px!important; text-align:left } h4 { font-size:24px!important; text-align:left } h5 { font-size:20px!important; text-align:left } h6 { font-size:16px!important; text-align:left } .es-header-body h1 a, .es-content-body h1 a, .es-footer-body h1 a { font-size:40px!important } .es-header-body h2 a, .es-content-body h2 a, .es-footer-body h2 a { font-size:32px!important } .es-header-body h3 a, .es-content-body h3 a, .es-footer-body h3 a { font-size:28px!important } .es-header-body h4 a, .es-content-body h4 a, .es-footer-body h4 a { font-size:24px!important } .es-header-body h5 a, .es-content-body h5 a, .es-footer-body h5 a { font-size:20px!important } .es-header-body h6 a, .es-content-body h6 a, .es-footer-body h6 a { font-size:16px!important } .es-menu td a { font-size:14px!important } .es-header-body p, .es-header-body a { font-size:14px!important } .es-content-body p, .es-content-body a { font-size:14px!important } .es-footer-body p, .es-footer-body a { font-size:14px!important } .es-infoblock p, .es-infoblock a { font-size:12px!important } .es-m-txt-c, .es-m-txt-c h1, .es-m-txt-c h2, .es-m-txt-c h3, .es-m-txt-c h4, .es-m-txt-c h5, .es-m-txt-c h6 { text-align:center!important } .es-m-txt-r, .es-m-txt-r h1, .es-m-txt-r h2, .es-m-txt-r h3, .es-m-txt-r h4, .es-m-txt-r h5, .es-m-txt-r h6 { text-align:right!important } .es-m-txt-j, .es-m-txt-j h1, .es-m-txt-j h2, .es-m-txt-j h3, .es-m-txt-j h4, .es-m-txt-j h5, .es-m-txt-j h6 { text-align:justify!important } .es-m-txt-l, .es-m-txt-l h1, .es-m-txt-l h2, .es-m-txt-l h3, .es-m-txt-l h4, .es-m-txt-l h5, .es-m-txt-l h6 { text-align:left!important } .es-button-border { display:inline-block!important } a.es-button, button.es-button { font-size:18px!important; padding:10px 30px 10px 30px!important; line-height:120%!important } a.es-button, button.es-button, .es-button-border { display:inline-block!important } .es-m-fw, .es-m-fw.es-fw, .es-m-fw .es-button { display:block!important } .es-m-il, .es-m-il .es-button, .es-social, .es-social td, .es-menu { display:inline-block!important } .es-adaptive table, .es-left, .es-right { width:100%!important } .es-content table, .es-header table, .es-footer table, .es-content, .es-footer, .es-header { width:100%!important; max-width:600px!important } .adapt-img { width:100%!important; height:auto!important } .es-mobile-hidden, .es-hidden { display:none!important } .es-desk-hidden { width:auto!important; overflow:visible!important; float:none!important; max-height:inherit!important; line-height:inherit!important } tr.es-desk-hidden { display:table-row!important } table.es-desk-hidden { display:table!important } td.es-desk-hidden { display:table-cell!important } .es-menu td { width:1%!important } table.es-table-not-adapt, .esd-block-html table { width:auto!important } .h-auto { height:auto!important } }
@media screen and (max-width:384px) {.mail-message-content { width:414px!important } }
</style>
 </head>
 <body class="body" style="width:100%;height:100%;font-family:arial, 'helvetica neue', helvetica, sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;padding:0;Margin:0">
  <!-- Preheader (inbox preview line; invisible in the body). -->
  <div style="display:none;font-size:1px;color:#05070B;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">{{client_name}}, welcome to Elite Coaching — your transformation starts now.</div>
  <div dir="ltr" class="es-wrapper-color" lang="en" style="background-color:#05070B"><!--[if gte mso 9]>
 <v:background xmlns:v="urn:schemas-microsoft-com:vml" fill="t">
   <v:fill type="tile"  color="#05070b" ></v:fill>
 </v:background>
<![endif]-->
   <table width="100%" cellspacing="0" cellpadding="0" class="es-wrapper" role="none" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-spacing:0px;padding:0;Margin:0;width:100%;height:100%">
     <tr>
      <td valign="top" style="padding:0;Margin:0">
       <table cellspacing="0" cellpadding="0" align="center" class="es-header" role="none" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-spacing:0px;width:100%;table-layout:fixed !important;background-color:transparent">
         <tr>
          <td align="center" style="padding:0;Margin:0">
           <table cellspacing="0" cellpadding="0" bgcolor="#ffffff" align="center" class="es-header-body" role="none" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-spacing:0px;background-color:#FFFFFF;width:700px">
             <tr>
              <td align="left" style="padding:0;Margin:0">
               <table cellspacing="0" cellpadding="0" width="100%" role="none" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-spacing:0px">
                 <tr>
                  <td valign="top" align="center" class="es-m-p20b" style="padding:0;Margin:0;width:700px">
                   <table width="100%" cellspacing="0" cellpadding="0" role="presentation" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-spacing:0px">
                     <tr>
                      <td align="center" style="padding:0;Margin:0;font-size:0"><a href="{{dashboard_url}}" target="_blank" rel="noopener" style="text-decoration:none;display:block;font-size:0;line-height:0;"><img alt="Welcome to Elite Coaching" height="1634" src="https://fzwnnfo.stripocdn.email/content/guids/CABINET_8f26cfc048e4c09e860a0c1ef3b52f0fd15f259882f5a8bb81672ae0c64c8581/images/file_00000000f94c720a804187d0067a77a3.png" class="adapt-img" style="display:block;font-size:14px;border:0;outline:none;text-decoration:none;margin:0"></a></td>
                     </tr>
                   </table></td>
                 </tr>
               </table></td>
             </tr>
           </table></td>
         </tr>
       </table></td>
     </tr>
   </table>
   <!-- Hidden support block (a11y / text-only fallback). -->
   <div style="display:none;font-size:1px;color:#05070B;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">Open your dashboard: {{dashboard_url}} · WhatsApp support: {{support_whatsapp_url}} · Email: {{support_email}}</div>
  </div>
 </body>
</html>`;

/** Escape user-supplied values before injection into HTML attributes / body. */
function esc(v: string): string {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Conservative plain-text fallback. The visible email is one image; the
 *  text version mirrors the inbox preview + the support links so Gmail's
 *  text view and screen readers still convey the message. */
function buildText(input: StripoWelcomeInput): string {
  return [
    `${input.clientName}, welcome to Elite Coaching.`,
    "",
    "You've taken the first step. Your transformation starts now.",
    "",
    `Open your dashboard: ${input.dashboardUrl}`,
    `WhatsApp support:   ${input.supportWhatsappUrl}`,
    `Email:              ${input.supportEmail}`,
    "",
    "— Coach Youssef",
  ].join("\n");
}

export function buildStripoWelcomeEmail(input: StripoWelcomeInput): ComposedEmail {
  const html = TEMPLATE_HTML
    .replace(/\{\{client_name\}\}/g, esc(input.clientName))
    .replace(/\{\{dashboard_url\}\}/g, esc(input.dashboardUrl))
    .replace(/\{\{support_whatsapp_url\}\}/g, esc(input.supportWhatsappUrl))
    .replace(/\{\{support_email\}\}/g, esc(input.supportEmail));

  const subject = input.subject ?? `Welcome to Elite Coaching, ${input.clientName}`;

  return {
    subject,
    html,
    text: buildText(input),
  };
}
