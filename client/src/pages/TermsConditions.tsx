import { LegalPage, LegalSection } from "@/components/LegalPage";
import { useTranslation } from "@/i18n";

export default function TermsConditions() {
  const { t } = useTranslation();
  return (
    <LegalPage
      eyebrow={t("legal.eyebrow")}
      title={t("legal.termsTitle")}
      lastUpdated={t("legal.aprilDate")}
      summary={t("legal.termsSummary")}
    >
      <LegalSection title={t("legal.terms.sec1Title")}>
        <p>{t("legal.terms.sec1Body")}</p>
      </LegalSection>

      <LegalSection title={t("legal.terms.sec2Title")}>
        <p>{t("legal.terms.sec2Body")}</p>
      </LegalSection>

      <LegalSection title={t("legal.terms.sec3Title")}>
        <p>{t("legal.terms.sec3Body")}</p>
      </LegalSection>

      <LegalSection title={t("legal.terms.sec4Title")}>
        <p>{t("legal.terms.sec4Body")}</p>
      </LegalSection>

      <LegalSection title={t("legal.terms.sec5Title")}>
        <p>
          {t("legal.terms.sec5BodyPre")}{" "}
          <a className="text-primary hover:opacity-80" href="/policy">
            {t("legal.terms.sec5LinkText")}
          </a>{" "}
          {t("legal.terms.sec5BodyPost")}
        </p>
      </LegalSection>

      <LegalSection title={t("legal.terms.sec6Title")}>
        <p>
          {t("legal.terms.sec6BodyPre")}{" "}
          <a className="text-primary hover:opacity-80" href="/medical-disclaimer">
            {t("legal.terms.sec6LinkText")}
          </a>
          {t("legal.terms.sec6BodyPost")}
        </p>
      </LegalSection>

      <LegalSection title={t("legal.terms.sec7Title")}>
        <ul>
          <li>{t("legal.terms.sec7Li1")}</li>
          <li>{t("legal.terms.sec7Li2")}</li>
          <li>{t("legal.terms.sec7Li3")}</li>
        </ul>
      </LegalSection>

      <LegalSection title={t("legal.terms.sec8Title")}>
        <p>{t("legal.terms.sec8Body")}</p>
      </LegalSection>

      <LegalSection title={t("legal.terms.sec9Title")}>
        <p>{t("legal.terms.sec9Body")}</p>
      </LegalSection>

      <LegalSection title={t("legal.terms.sec10Title")}>
        <p>{t("legal.terms.sec10Body")}</p>
      </LegalSection>

      {/* New premium-business clauses */}
      <LegalSection title={t("legal.terms.sec11Title")}>
        <p>{t("legal.terms.sec11Body")}</p>
      </LegalSection>

      <LegalSection title={t("legal.terms.sec12Title")}>
        <p>{t("legal.terms.sec12Body")}</p>
      </LegalSection>

      <LegalSection title={t("legal.terms.sec13Title")}>
        <p>{t("legal.terms.sec13Body")}</p>
      </LegalSection>

      <LegalSection title={t("legal.terms.sec14Title")}>
        <p>{t("legal.terms.sec14Body")}</p>
      </LegalSection>

      <LegalSection title={t("legal.terms.sec15Title")}>
        <p>{t("legal.terms.sec15Body")}</p>
      </LegalSection>
    </LegalPage>
  );
}
