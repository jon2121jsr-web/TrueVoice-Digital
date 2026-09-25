// src/pages/PrivacyPolicy.jsx
// Public Privacy Policy page — required by Apple/Google for app store
// submission. Kept as a plain, honest description of what the app
// actually collects (see /src/lib/analytics.js, /src/lib/pushNotifications.js,
// /src/components/ChimeIn.jsx) rather than boilerplate legal text.
import { Link } from "react-router-dom";
import "./PrivacyPolicy.css";

const SUPPORT_EMAIL_DISPLAY = "info@outputdigital.xyz";
const SUPPORT_EMAIL_MAILTO = "john@outputdigital.xyz";
const EFFECTIVE_DATE = "September 25, 2026";

export default function PrivacyPolicy() {
  return (
    <div className="tv-privacy-page">
      <header className="tv-privacy-header">
        <Link to="/" className="tv-privacy-brand">TrueVoice.Digital</Link>
      </header>

      <main className="tv-privacy-main">
        <h1>Privacy Policy</h1>
        <p className="tv-privacy-effective">Effective {EFFECTIVE_DATE}</p>

        <p>
          TrueVoice Digital ("we," "us," "our") operates the TrueVoice Digital
          app and website (truevoice.digital). This policy explains what
          information we collect and how we use it.
        </p>

        <h2>Information we collect</h2>

        <h3>Usage analytics</h3>
        <p>
          We collect anonymous data about how the app is used — pages
          viewed, when you play the live stream or a video, and button taps
          like donation clicks. This is tied to a random session identifier,
          not to your name or identity, and is used only to understand how
          people use the app so we can improve it.
        </p>

        <h3>Email address (optional)</h3>
        <p>
          If you choose to sign in to use "Chime In" and post messages in
          the live chat, we ask for your email address to send you a
          one-time sign-in link. We use this only to authenticate you and
          do not use it for marketing without your separate consent.
        </p>

        <h3>Push notification token (optional)</h3>
        <p>
          If you enable push notifications, your device registers a
          notification token with us so we can send you updates, such as
          new content alerts. You can disable this at any time in your
          device settings.
        </p>

        <h3>Donations</h3>
        <p>
          If you choose to give through the app, your payment is processed
          directly by Stripe, our payment processor. We do not collect or
          store your card number or banking details.
        </p>

        <h2>How we use information</h2>
        <p>
          We use the information above to operate and improve TrueVoice
          Digital, respond to you when you contact us, and, where you've
          opted in, to send you notifications. We do not sell your
          information to third parties.
        </p>

        <h2>Third-party services</h2>
        <p>
          We use Supabase (authentication and data storage), Stripe
          (payment processing), and standard analytics infrastructure. Each
          handles data under its own privacy practices.
        </p>

        <h2>Children's privacy</h2>
        <p>
          TrueVoice Digital is not directed to children under 13, and we do
          not knowingly collect personal information from children under
          13.
        </p>

        <h2>Your choices</h2>
        <p>
          You can use TrueVoice Digital without signing in or enabling
          notifications. To request that we delete your account or data,
          contact us at{" "}
          <a href={`mailto:${SUPPORT_EMAIL_MAILTO}`}>{SUPPORT_EMAIL_DISPLAY}</a>.
        </p>

        <h2>Changes to this policy</h2>
        <p>
          We may update this policy from time to time. Changes will be
          posted on this page with a new effective date.
        </p>

        <h2>Contact us</h2>
        <p>
          Questions about this policy? Email us at{" "}
          <a href={`mailto:${SUPPORT_EMAIL_MAILTO}`}>{SUPPORT_EMAIL_DISPLAY}</a>.
        </p>

        <p className="tv-privacy-back">
          <Link to="/">&larr; Back to TrueVoice.Digital</Link>
        </p>
      </main>
    </div>
  );
}
