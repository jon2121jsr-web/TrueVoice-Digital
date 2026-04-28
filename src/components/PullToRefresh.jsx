import { useEffect, useRef } from "react";

const THRESHOLD = 80; // px of pull needed to trigger

export default function PullToRefresh() {
  const startY = useRef(null);
  const pulling = useRef(false);
  const indicator = useRef(null);

  useEffect(() => {
    const onTouchStart = (e) => {
      // Only activate when already at top of page
      if (window.scrollY === 0) {
        startY.current = e.touches[0].clientY;
        pulling.current = true;
      }
    };

    const onTouchMove = (e) => {
      if (!pulling.current || startY.current === null) return;
      const deltaY = e.touches[0].clientY - startY.current;
      if (deltaY <= 0) {
        pulling.current = false;
        return;
      }
      // Show indicator proportionally
      if (indicator.current) {
        const progress = Math.min(deltaY / THRESHOLD, 1);
        indicator.current.style.opacity = progress;
        indicator.current.style.transform = `translateY(${Math.min(deltaY * 0.4, 40)}px)`;
      }
    };

    const onTouchEnd = (e) => {
      if (!pulling.current || startY.current === null) return;
      const deltaY = e.changedTouches[0].clientY - startY.current;
      pulling.current = false;
      startY.current = null;
      if (indicator.current) {
        indicator.current.style.opacity = 0;
        indicator.current.style.transform = "translateY(0)";
      }
      if (deltaY >= THRESHOLD) {
        window.location.reload();
      }
    };

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: true });
    document.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  return (
    <div
      ref={indicator}
      style={{
        position: "fixed",
        top: 8,
        left: "50%",
        transform: "translateX(-50%)",
        opacity: 0,
        transition: "opacity 0.15s, transform 0.15s",
        zIndex: 9999,
        background: "rgba(39,95,219,0.85)",
        color: "#fff",
        borderRadius: 100,
        padding: "6px 18px",
        fontSize: 13,
        fontWeight: 700,
        pointerEvents: "none",
        backdropFilter: "blur(6px)",
        letterSpacing: "0.05em",
      }}
    >
      ↓ Release to refresh
    </div>
  );
}
