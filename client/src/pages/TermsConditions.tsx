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
      <LegalSection title="1. The service">
        <p>
          Youssef Fitness provides personal training, body composition tracking, and structured
          coaching to clients in Dubai. Sessions can take place at agreed locations or as otherwise
          arranged with Youssef directly.
        </p>
      </LegalSection>

      <LegalSection title="2. Eligibility & accurate information">
        <p>
          You must be at least 18 years old to create an account, or have explicit parental consent
          if registering for a minor. By registering, you confirm that all the information you
          provide — including health, medical, and emergency contact details — is accurate and up to
          date.
        </p>
      </LegalSection>

      <LegalSection title="3. Packages & payment">
        <p>
          Training packages (10, 20, 25 sessions, and Duo packages) are non-refundable once
          activated and are personal to you (or to the duo partner you registered with). Sessions
          are deducted as they are completed or as they are charged according to the cancellation
          policy. Package balances and expiry are managed by Youssef and visible in your dashboard.
        </p>
      </LegalSection>

      <LegalSection title="4. Bookings & attendance">
        <p>
          You can book, view, and cancel sessions through your client dashboard. Late arrivals
          shorten the session — sessions still end at the originally scheduled time. Repeated
          no-shows or last-minute cancellations may, at Youssef's discretion, result in suspension
          of booking access.
        </p>
      </LegalSection>

      <LegalSection title="5. Cancellation policy">
        <p>
          Our cancellation policy is part of these Terms. By booking, you agree that cancellations
          made within the cutoff window will be treated as a used session and charged against your
          package. Read the full{" "}
          <a className="text-primary hover:opacity-80" href="/policy">
            Cancellation Policy
          </a>{" "}
          for details.
        </p>
      </LegalSection>

      <LegalSection title="6. Health & medical responsibility">
        <p>
          You are responsible for ensuring you are medically fit to train. Read the full{" "}
          <a className="text-primary hover:opacity-80" href="/medical-disclaimer">
            Medical Disclaimer
          </a>
          . You must inform Youssef immediately of any new injury, illness, pregnancy, medication,
          or condition that may affect your safety during training.
        </p>
      </LegalSection>

      <LegalSection title="7. Acceptable use">
        <ul>
          <li>Do not share your account credentials with anyone.</li>
          <li>Do not attempt to access other clients' data.</li>
          <li>Do not upload content that is unlawful, abusive, or unrelated to coaching.</li>
        </ul>
      </LegalSection>

      <LegalSection title="8. Limitation of liability">
        <p>
          Youssef Fitness will deliver coaching with reasonable professional care. Training carries
          inherent risk and you accept this risk by participating. To the fullest extent permitted
          by UAE law, Youssef Fitness is not liable for indirect or consequential losses arising
          from your use of the service.
        </p>
      </LegalSection>

      <LegalSection title="9. Termination">
        <p>
          You may close your account at any time. Youssef Fitness may suspend or terminate your
          access for breach of these Terms, abusive behavior, or repeated policy violations. Unused
          package balances in such cases may be forfeited at Youssef's discretion.
        </p>
      </LegalSection>

      <LegalSection title="10. Governing law">
        <p>
          These Terms are governed by the laws of the United Arab Emirates and the Emirate of
          Dubai. Any disputes will be resolved in the competent courts of Dubai.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
