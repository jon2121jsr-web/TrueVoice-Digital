// src/components/VerseOfTheDay.jsx
import { useEffect, useState } from "react";
import { fetchVerseOfTheDay } from "../services/api";

export function VerseOfTheDay() {
  const [verse, setVerse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        setLoading(true);
        const v = await fetchVerseOfTheDay();
        if (isMounted) {
          setVerse(v);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || "Failed to load Verse of the Day.");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    load();

    const id = window.setInterval(load, 6 * 60 * 60 * 1000);
    return () => {
      isMounted = false;
      window.clearInterval(id);
    };
  }, []);

  return (
    <section className="votd card">
      <h3>Verse of the Day</h3>

      {loading && !verse && <p>Loading verse…</p>}

      {error && (
        <p className="error">
          Could not load verse. <br />
          <small>{error}</small>
        </p>
      )}

      {verse && !error && (
        <>
          <p className="votd-text">&ldquo;{verse.text}&rdquo;</p>
          <p className="votd-ref">
            {verse.reference}{" "}
            <span className="votd-version">({verse.version})</span>
          </p>
        </>
      )}
    </section>
  );
}
