// src/components/ChimeIn.jsx
import { useEffect, useRef, useState } from "react";
import { supabaseRealtime } from "../lib/supabaseRealtime";
import "./ChimeIn.css";

function formatRelativeTime(iso) {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 30) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function ChimeIn() {
  const [isOpen, setIsOpen] = useState(false);
  const [session, setSession] = useState(null);

  const [email, setEmail] = useState("");
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState(null);

  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState("");
  const [sending, setSending] = useState(false);

  // Re-render periodically so relative timestamps ("2m ago") stay fresh
  // even when no new message arrives to trigger a render.
  const [, setTimeTick] = useState(0);

  const drawerRef = useRef(null);
  const tabRef = useRef(null);
  const feedEndRef = useRef(null);
  const lastFocusedRef = useRef(null);

  const toggleDrawer = () => setIsOpen((open) => !open);
  const closeDrawer = () => setIsOpen(false);

  /* ── Auth session bootstrap + subscription ─────────────────────────────── */
  useEffect(() => {
    if (window.location.hash.includes("access_token")) {
      setIsOpen(true);
    }

    supabaseRealtime.auth.getSession().then(({ data }) => {
      setSession(data?.session ?? null);
    });

    const { data: authSub } = supabaseRealtime.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => authSub?.subscription?.unsubscribe();
  }, []);

  /* ── Message feed: initial fetch + Realtime subscription ───────────────── */
  useEffect(() => {
    if (!session) { setMessages([]); return; }
    let alive = true;

    async function loadMessages() {
      const { data, error } = await supabaseRealtime
        .from("chime_messages")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (alive && !error) setMessages((data ?? []).slice().reverse());
    }
    loadMessages();

    const channel = supabaseRealtime
      .channel("chime_messages_feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chime_messages" },
        (payload) => setMessages((prev) => [...prev, payload.new])
      )
      .subscribe();

    return () => {
      alive = false;
      supabaseRealtime.removeChannel(channel);
    };
  }, [session]);

  /* ── Auto-scroll feed to bottom on new message ──────────────────────────── */
  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  /* ── Keep relative timestamps fresh ─────────────────────────────────────── */
  useEffect(() => {
    const id = window.setInterval(() => setTimeTick((t) => t + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  /* ── Focus trap + Escape-to-close while drawer is open ──────────────────── */
  useEffect(() => {
    if (!isOpen) return;
    const drawer = drawerRef.current;
    if (!drawer) return;

    lastFocusedRef.current = document.activeElement;

    const getFocusable = () =>
      Array.from(
        drawer.querySelectorAll('button, input, a[href], [tabindex]:not([tabindex="-1"])')
      ).filter((el) => !el.disabled);

    const focusables = getFocusable();
    (focusables[0] ?? drawer).focus();

    function onKeyDown(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        setIsOpen(false);
        return;
      }
      if (e.key !== "Tab") return;
      const current = getFocusable();
      if (current.length === 0) return;
      const first = current[0];
      const last = current[current.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      lastFocusedRef.current?.focus?.();
    };
  }, [isOpen]);

  /* ── Auth actions ────────────────────────────────────────────────────────── */
  async function handleMagicLink(e) {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);
    const { error } = await supabaseRealtime.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: "https://truevoice.digital" },
    });
    setAuthLoading(false);
    if (error) { setAuthError(error.message); return; }
    setMagicLinkSent(true);
  }

  async function handleSignOut() {
    await supabaseRealtime.auth.signOut();
    setMagicLinkSent(false);
    setEmail("");
  }

  /* ── Send message ───────────────────────────────────────────────────────── */
  async function handleSend(e) {
    e.preventDefault();
    const trimmed = messageInput.trim();
    if (!trimmed || !session) return;
    setSending(true);
    const displayName = session.user.email.split("@")[0];
    const { error } = await supabaseRealtime.from("chime_messages").insert({
      user_id: session.user.id,
      display_name: displayName,
      message: trimmed,
    });
    setSending(false);
    if (!error) setMessageInput("");
  }

  return (
    <>
      <div
        ref={tabRef}
        className="chime-tab"
        role="button"
        tabIndex={0}
        aria-expanded={isOpen}
        onClick={toggleDrawer}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggleDrawer();
          }
        }}
      >
        💬 Chime In
      </div>

      <div
        ref={drawerRef}
        className={`chime-drawer ${isOpen ? "open" : "closed"}`}
        role="dialog"
        aria-modal="true"
        aria-hidden={!isOpen}
        aria-label="Chime In chat"
        tabIndex={-1}
      >
        <div className="chime-header">
          <span className="chime-header-title">Chime In</span>
          <button
            type="button"
            className="chime-close-btn"
            onClick={closeDrawer}
            aria-label="Close chat"
          >
            ×
          </button>
        </div>

        <div className="chime-body">
          {session ? (
            <>
              <div className="chime-user-bar">
                <span className="chime-user-email">{session.user.email}</span>
                <button type="button" className="chime-signout-btn" onClick={handleSignOut}>
                  Sign out
                </button>
              </div>

              <div className="chime-feed">
                {messages.map((m) => (
                  <div key={m.id} className="chime-message">
                    <span className="chime-message-name">{m.display_name}</span>
                    <span className="chime-message-text">{m.message}</span>
                    <span className="chime-message-time">{formatRelativeTime(m.created_at)}</span>
                  </div>
                ))}
                <div ref={feedEndRef} />
              </div>

              <form className="chime-send-form" onSubmit={handleSend}>
                <input
                  type="text"
                  className="chime-send-input"
                  value={messageInput}
                  maxLength={280}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder="Say something…"
                />
                <span className="chime-char-count">{messageInput.length}/280</span>
                <button
                  type="submit"
                  className="chime-send-btn"
                  disabled={!messageInput.trim() || sending}
                >
                  Send
                </button>
              </form>
            </>
          ) : (
            <form className="chime-auth-form" onSubmit={handleMagicLink}>
              <p className="chime-auth-copy">Join the conversation — sign in with your email</p>
              {magicLinkSent ? (
                <p className="chime-auth-success">Check your email for a magic link ✉️</p>
              ) : (
                <>
                  <input
                    type="email"
                    className="chime-email-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                  />
                  {authError && <p className="chime-auth-error">{authError}</p>}
                  <button type="submit" className="chime-auth-btn" disabled={authLoading}>
                    {authLoading ? "Sending…" : "Send me a link"}
                  </button>
                </>
              )}
            </form>
          )}
        </div>
      </div>

      {isOpen && <div className="chime-backdrop" onClick={closeDrawer} />}
    </>
  );
}
