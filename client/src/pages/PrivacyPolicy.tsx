import { LegalPage, LegalSection } from "@/components/LegalPage";

export default function PrivacyPolicy() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Privacy Policy"
      lastUpdated="April 2026"
      summary="This Privacy Policy explains how Youssef Fitness collects, uses, stores, and protects your personal data when you register, book sessions, or upload health information through this platform."
    >
      <LegalSection title="1. Who we are">
        <p>
          Youssef Fitness is a personal training service operated by Youssef Ahmed, a certified
          personal trainer based in Dubai, United Arab Emirates. References to "we", "us", and "our"
          throughout this policy refer to Youssef Fitness.
        </p>
      </LegalSection>

      <LegalSection title="2. What we collect">
        <ul>
          <li>Account details — full name, email, phone number, area, password.</li>
          <li>Emergency contact — name and phone number.</li>
          <li>Fitness information — goal, notes about injuries or medical considerations.</li>
          <li>Body composition — InBody scans (image or PDF) and AI-extracted metrics.</li>
          <li>Progress photos — only when you choose to upload them.</li>
          <li>Booking data — sessions, attendance, package usage, cancellation history.</li>
          <li>
            Technical data — IP address, device/browser info, and session cookies needed to keep you
            signed in.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="3. How we use it">
        <p>We use your data only for the following purposes:</p>
        <ul>
          <li>Delivering personal training, programming, and coaching to you.</li>
          <li>Managing bookings, packages, attendance, and cancellations.</li>
          <li>Tracking your progress and body composition over time.</li>
          <li>Contacting you about your sessions, progress, or schedule changes.</li>
          <li>Responding to safety situations using your emergency contact when needed.</li>
          <li>Improving the platform and keeping it secure.</li>
        </ul>
        <p>
          We do not sell your personal data. We do not use your information for advertising to third
          parties.
        </p>
      </LegalSection>

      <LegalSection title="4. AI-assisted InBody analysis">
        <p>
          Uploaded InBody images may be processed by an AI vision model to automatically extract
          metrics such as weight, body fat, muscle mass, and BMI. AI-extracted values are always
          reviewed and confirmed by Youssef before they are used in your coaching.
        </p>
      </LegalSection>

      <LegalSection title="5. Storage and security">
        <p>
          Your data is stored on secured servers. Files (InBody scans and progress photos) are kept
          in protected upload folders accessible only to you and Youssef. Passwords are stored in
          hashed form and are never visible to anyone, including Youssef.
        </p>
      </LegalSection>

      <LegalSection title="6. How long we keep your data">
        <p>
          We keep your account, training history, body composition records, and progress photos for
          as long as you remain an active client and for a reasonable period afterwards for
          historical and legal reasons. You can ask us to delete your data at any time.
        </p>
      </LegalSection>

      <LegalSection title="7. Your rights">
        <p>You can ask us at any time to:</p>
        <ul>
          <li>See what personal data we hold about you.</li>
          <li>Correct anything that's wrong or out of date.</li>
          <li>Delete your account and associated data.</li>
          <li>Withdraw consent for optional data uses (such as progress photos).</li>
        </ul>
        <p>
          To exercise any of these rights, contact Youssef directly via WhatsApp at{" "}
          <a className="text-primary hover:opacity-80" href="https://wa.me/971505394754">
            +971 50 539 4754
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="8. Changes to this policy">
        <p>
          We may update this policy from time to time. The "last updated" date at the top of the
          page reflects the most recent version. Continued use of the platform after changes means
          you accept the updated policy.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
