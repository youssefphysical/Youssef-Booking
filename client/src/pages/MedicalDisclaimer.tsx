import { LegalPage, LegalSection } from "@/components/LegalPage";
import { useTranslation } from "@/i18n";

export default function MedicalDisclaimer() {
  const { t } = useTranslation();
  return (
    <LegalPage
      eyebrow={t("legal.eyebrow")}
      title={t("legal.medicalTitle")}
      lastUpdated={t("legal.aprilDate")}
      summary={t("legal.medicalSummary")}
    >
      <LegalSection title={t("legal.medical.sec1Title")}>
        <p>{t("legal.medical.sec1Body")}</p>
      </LegalSection>

      <LegalSection title={t("legal.medical.sec2Title")}>
        <p>{t("legal.medical.sec2Body")}</p>
        <ul>
          <li>{t("legal.medical.sec2Li1")}</li>
          <li>{t("legal.medical.sec2Li2")}</li>
          <li>{t("legal.medical.sec2Li3")}</li>
          <li>{t("legal.medical.sec2Li4")}</li>
          <li>{t("legal.medical.sec2Li5")}</li>
          <li>{t("legal.medical.sec2Li6")}</li>
        </ul>
      </LegalSection>

      <LegalSection title={t("legal.medical.sec3Title")}>
        <p>{t("legal.medical.sec3Body")}</p>
        <ul>
          <li>{t("legal.medical.sec3Li1")}</li>
          <li>{t("legal.medical.sec3Li2")}</li>
          <li>{t("legal.medical.sec3Li3")}</li>
          <li>{t("legal.medical.sec3Li4")}</li>
        </ul>
      </LegalSection>

      <LegalSection title={t("legal.medical.sec4Title")}>
        <p>{t("legal.medical.sec4Body")}</p>
      </LegalSection>

      <LegalSection title={t("legal.medical.sec5Title")}>
        <p>{t("legal.medical.sec5Body")}</p>
      </LegalSection>
    </LegalPage>
  );
}
