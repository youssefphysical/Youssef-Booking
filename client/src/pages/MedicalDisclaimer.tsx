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
      <LegalSection title="1. Not medical advice">
        <p>
          Information, programs, and recommendations shared by Youssef Fitness — including
          training plans, nutrition guidance, body composition feedback, and anything written or
          discussed during sessions — are for general fitness and educational purposes only. They
          are not a substitute for professional medical advice, diagnosis, or treatment.
        </p>
      </LegalSection>

      <LegalSection title="2. Consult your doctor first">
        <p>
          Before starting any new exercise program — and before any major change to an existing one
          — you should consult a qualified medical professional, especially if you:
        </p>
        <ul>
          <li>Have a heart condition, high blood pressure, or any cardiovascular issue.</li>
          <li>Are pregnant, recently gave birth, or are breastfeeding.</li>
          <li>Have a chronic condition (diabetes, asthma, autoimmune, etc.).</li>
          <li>Have current or recent injuries, surgeries, or rehabilitation needs.</li>
          <li>Take medication that affects exercise tolerance.</li>
          <li>Are returning to training after a long break.</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Your responsibility">
        <p>
          By using this platform and booking sessions you confirm that:
        </p>
        <ul>
          <li>You are medically fit to participate in physical training.</li>
          <li>You have disclosed any relevant condition, injury, or medication to Youssef.</li>
          <li>
            You will immediately stop and inform Youssef if you feel pain, dizziness, shortness of
            breath, or any unusual symptom during a session.
          </li>
          <li>
            You accept that exercise carries inherent risk of injury and you participate at your
            own risk.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Emergency situations">
        <p>
          If you experience symptoms during a session that may indicate a medical emergency — such
          as chest pain, fainting, severe shortness of breath, or sudden weakness — emergency
          services should be contacted immediately. Your declared emergency contact may also be
          informed.
        </p>
      </LegalSection>

      <LegalSection title="5. InBody data">
        <p>
          InBody scans are used as a coaching tool to track body composition trends. They are not a
          medical diagnostic. Numbers may vary day to day depending on hydration, food intake,
          training, and other factors and should not be interpreted as a medical assessment.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
