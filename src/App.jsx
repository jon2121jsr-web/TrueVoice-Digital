// src/App.jsx
export default function App() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top bar */}
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-slate-200">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight">
            TrueVoice Digital
          </h1>
          <a
            href="https://stream.truevoice.digital/public/truevoice_digital"
            className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
            target="_blank"
            rel="noreferrer"
          >
            Open Player ↗
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 space-y-10">
        {/* Now Playing + Full Player */}
        <section className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Now Playing card (simple placeholder—pulls from iframe below) */}
          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-500">NOW PLAYING</p>
              <h2 className="mt-2 text-2xl font-semibold">Live Stream</h2>
              <p className="mt-1 text-sm text-slate-600">
                Listen live and share with friends. Recent tracks available in the player.
              </p>

              <div className="mt-4 flex items-center gap-3">
                <a
                  href="https://stream.truevoice.digital/radio/8000/radio.mp3"
                  className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-white text-sm font-medium hover:bg-indigo-500"
                  target="_blank"
                  rel="noreferrer"
                >
                  ▶ Play Live (Direct)
                </a>
                <a
                  href="https://stream.truevoice.digital/public/truevoice_digital"
                  className="inline-flex items-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
                  target="_blank"
                  rel="noreferrer"
                >
                  Recent Tracks
                </a>
              </div>
            </div>
          </div>

          {/* Full Player (AzuraCast embed) */}
          <div className="lg:col-span-3">
            <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-white">
              {/* This is the FULL PLAYER embed */}
              <iframe
                src="https://stream.truevoice.digital/public/truevoice_digital/embed"
                title="TrueVoice Digital Player"
                className="w-full h-[540px]"  /* adjust height as you like */
                frameBorder="0"
                allow="autoplay; clipboard-read; clipboard-write; encrypted-media *;"
              />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              If the player doesn’t load, your browser’s script/iframe blocking may need to allow this site.
            </p>
          </div>
        </section>

        {/* Featured rows (placeholders you can fill later) */}
        <section className="space-y-6">
          <h3 className="text-lg font-semibold">Featured Podcasts</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="h-36 rounded-xl bg-slate-100 mb-4" />
                <p className="font-medium">Podcast Episode</p>
                <p className="text-sm text-slate-600">Brief description goes here.</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="font-medium">Prayer Request</p>
            <p className="text-sm text-slate-600 mt-1">Share a request with the team.</p>
            <button className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-white text-sm font-medium hover:bg-indigo-500">
              Submit
            </button>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="font-medium">Share an Encouragement</p>
            <p className="text-sm text-slate-600 mt-1">Tell us what God’s doing.</p>
            <button className="mt-3 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50">
              Share
            </button>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="font-medium">Support the Mission</p>
            <p className="text-sm text-slate-600 mt-1">Keep TrueVoice streaming strong.</p>
            <button className="mt-3 rounded-lg bg-emerald-600 px-4 py-2 text-white text-sm font-medium hover:bg-emerald-500">
              Give
            </button>
          </div>
        </section>
      </main>

      <footer className="mt-14 border-t border-slate-200">
        <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-slate-500">
          © {new Date().getFullYear()} TrueVoice Digital. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
