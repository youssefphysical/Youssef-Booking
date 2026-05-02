import { LegalPage, LegalSection } from "@/components/LegalPage";
import { useTranslation } from "@/i18n";

export default function CookiePolicy() {
  const { t } = useTranslation();
  return (
    <LegalPage
      eyebrow={t("legal.eyebrow")}
      title={t("legal.cookieTitle")}
      lastUpdated={t("legal.aprilDate")}
      summary={t("legal.cookieSummary")}
    >
      <LegalSection title="1. What cookies are">
        <p>
          Cookies are small text files stored on your device when you visit a website. They allow
          the site to remember your actions and preferences over time, so you don't have to keep
          re-entering them.
        </p>
      </LegalSection>

      <LegalSection title="2. Categories we use">
        <ul>
          <li>
            <strong>Essential cookies</strong> — required to keep you signed in, protect your
            session, and run core platform features. These cannot be disabled.
          </li>
          <li>
            <strong>Analytics cookies</strong> — optional. Help us understand how the site is used
            so we can improve it. We only enable these with your consent.
          </li>
          <li>
            <strong>Marketing cookies</strong> — optional. Used for personalization and marketing
            where allowed. We only enable these with your consent.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Your choices">
        <p>
          When you first visit the site, you'll see a cookie banner where you can accept all
          cookies, reject non-essential cookies, or choose category by category. You can clear your
          stored consent in your browser at any time to bring the banner back and change your
          choices.
        </p>
      </LegalSection>

      <LegalSection title="4. Third-party services">
        <p>
          We may use trusted third-party services for hosting, analytics, and AI-assisted InBody
          analysis. These services may use their own technical cookies as needed to function. They
          do not receive any of your personal training data beyond what is necessary to provide
          their service.
        </p>
      </LegalSection>

      <LegalSection title="5. Contact">
        <p>
          For any question about cookies or your data, message Youssef on{" "}
          <a className="text-primary hover:opacity-80" href="https://wa.me/971505394754">
            WhatsApp
          </a>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
