import { LegalPage, LegalSection } from "@/components/LegalPage";
import { useTranslation } from "@/i18n";

export default function PrivacyPolicy() {
  const { t } = useTranslation();
  return (
    <LegalPage
      eyebrow={t("legal.eyebrow")}
      title={t("legal.privacyTitle")}
      lastUpdated={t("legal.aprilDate")}
      summary={t("legal.privacySummary")}
    >
      <LegalSection title={t("legal.privacy.sec1Title")}>
        <p>{t("legal.privacy.sec1Body")}</p>
      </LegalSection>

      <LegalSection title={t("legal.privacy.sec2Title")}>
        <ul>
          <li>{t("legal.privacy.sec2Li1")}</li>
          <li>{t("legal.privacy.sec2Li2")}</li>
          <li>{t("legal.privacy.sec2Li3")}</li>
          <li>{t("legal.privacy.sec2Li4")}</li>
          <li>{t("legal.privacy.sec2Li5")}</li>
          <li>{t("legal.privacy.sec2Li6")}</li>
          <li>{t("legal.privacy.sec2Li7")}</li>
        </ul>
      </LegalSection>

      <LegalSection title={t("legal.privacy.sec3Title")}>
        <p>{t("legal.privacy.sec3Intro")}</p>
        <ul>
          <li>{t("legal.privacy.sec3Li1")}</li>
          <li>{t("legal.privacy.sec3Li2")}</li>
          <li>{t("legal.privacy.sec3Li3")}</li>
          <li>{t("legal.privacy.sec3Li4")}</li>
          <li>{t("legal.privacy.sec3Li5")}</li>
          <li>{t("legal.privacy.sec3Li6")}</li>
        </ul>
        <p>{t("legal.privacy.sec3Outro")}</p>
      </LegalSection>

      <LegalSection title={t("legal.privacy.sec4Title")}>
        <p>{t("legal.privacy.sec4Body")}</p>
      </LegalSection>

      <LegalSection title={t("legal.privacy.sec5Title")}>
        <p>{t("legal.privacy.sec5Body")}</p>
      </LegalSection>

      <LegalSection title={t("legal.privacy.sec6Title")}>
        <p>{t("legal.privacy.sec6Body")}</p>
      </LegalSection>

      <LegalSection title={t("legal.privacy.sec7Title")}>
        <p>{t("legal.privacy.sec7Intro")}</p>
        <ul>
          <li>{t("legal.privacy.sec7Li1")}</li>
          <li>{t("legal.privacy.sec7Li2")}</li>
          <li>{t("legal.privacy.sec7Li3")}</li>
          <li>{t("legal.privacy.sec7Li4")}</li>
        </ul>
        <p>
          {t("legal.privacy.sec7Outro")}{" "}
          <a className="text-primary hover:opacity-80" href="https://wa.me/971505394754">
            +971 50 539 4754
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title={t("legal.privacy.sec8Title")}>
        <p>{t("legal.privacy.sec8Body")}</p>
      </LegalSection>
    </LegalPage>
  );
}
