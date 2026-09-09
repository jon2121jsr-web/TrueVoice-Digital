// src/components/ReactionRail.jsx
// Heart-react (sign-in gated, backed by feed_reactions) + Share (native
// share sheet / clipboard copy, no auth needed) for one feed card.
// Signed-out tap opens an inline magic-link prompt using the same
// supabaseRealtime auth flow ChimeIn uses -- no separate auth system.
import { useState } from "react";
import { supabaseRealtime } from "../lib/supabaseRealtime";
import { trackEvent } from "../lib/analytics";
import "./ReactionRail.css";

function ShareButton({ item }) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    // Path-based, not a hash fragment -- a bot-facing rewrite in
    // vercel.json routes this exact shape to api/og/[id].js so shared
    // links carry a real per-item preview instead of the homepage's.
    // See the funnel audit, §04/§07.
    const url = `${window.location.origin}/scroll/${item.id}`;
    const shareData = {
      title: item.title || "TrueVoice Digital",
      text: item.title ? `"${item.title}" on TrueVoice Digital` : "Check this out on TrueVoice Digital",
      url,
    };
    const channel = navigator.share ? "native_share" : "clipboard";
    trackEvent("scroll_share", { site: "scroll", item_id: item.id, channel });
    if (navigator.share) {
      try { await navigator.share(shareData); } catch { /* user cancelled -- not an error */ }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard unavailable -- silently no-op */ }
  }

  return (
    <button type="button" className="feed-rail-btn" onClick={handleShare} aria-label="Share">
      <span className="feed-rail-icon">{copied ? "✓" : "↗"}</span>
      <span className="feed-rail-label">{copied ? "Copied" : "Share"}</span>
    </button>
  );
}

function SignInPopover({ onClose }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: signInError } = await supabaseRealtime.auth.signInWithOtp({
      email,
      // Return to wherever this was opened from (dev LAN address, localhost,
      // or production) instead of hardcoding one -- unlike ChimeIn's fixed
      // prod URL, this needs to work for local/phone testing too. Requires
      // that origin to be listed under Supabase Auth -> URL Configuration
      // -> Redirect URLs, or Supabase will refuse the redirect.
      options: { emailRedirectTo: `${window.location.origin}/scroll` },
    });
    setLoading(false);
    if (signInError) { setError(signInError.message); return; }
    // "Requested," not "complete" -- the actual sign-in finishes on a
    // different page load after the visitor clicks the emailed link,
    // which this component has no hook into. See the funnel audit, §06.
    trackEvent("scroll_signin_requested", { site: "scroll" });
    setSent(true);
  }

  return (
    <div className="feed-signin-backdrop" onClick={onClose}>
      <form className="feed-signin-popover" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <button type="button" className="feed-signin-close" onClick={onClose} aria-label="Close">×</button>
        {sent ? (
          <p className="feed-signin-success">Check your email for a sign-in link ✉️</p>
        ) : (
          <>
            <p className="feed-signin-copy">Sign in to react</p>
            <input
              type="email"
              className="feed-signin-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
            {error && <p className="feed-signin-error">{error}</p>}
            <button type="submit" className="feed-signin-btn" disabled={loading}>
              {loading ? "Sending…" : "Send me a link"}
            </button>
          </>
        )}
      </form>
    </div>
  );
}

export default function ReactionRail({ item, session, reaction, onToggleReaction }) {
  const [showSignIn, setShowSignIn] = useState(false);

  function handleHeartClick() {
    if (!session) {
      trackEvent("scroll_signin_start", { site: "scroll", trigger: "react", item_id: item.id });
      setShowSignIn(true);
      return;
    }
    trackEvent("scroll_react", { site: "scroll", item_id: item.id, reacted: !(reaction?.reacted ?? false) });
    onToggleReaction(item.id);
  }

  const reacted = reaction?.reacted ?? false;
  const count = reaction?.count ?? 0;

  return (
    <>
      <div className="feed-rail">
        <button
          type="button"
          className={`feed-rail-btn feed-heart-btn${reacted ? " reacted" : ""}`}
          onClick={handleHeartClick}
          aria-label={reacted ? "Remove reaction" : "React"}
        >
          <span className="feed-rail-icon">{reacted ? "❤️" : "🤍"}</span>
          <span className="feed-rail-label">{session ? count : ""}</span>
        </button>
        <ShareButton item={item} />
      </div>
      {showSignIn && <SignInPopover onClose={() => setShowSignIn(false)} />}
    </>
  );
}
