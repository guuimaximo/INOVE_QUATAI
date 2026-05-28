import { useEffect, useRef, useState } from "react";
import { FaSync } from "react-icons/fa";

/**
 * Pull-to-refresh estilo mobile.
 * Envolve qualquer conteúdo; chama onRefresh quando o usuário puxa pra baixo.
 */
export default function PullToRefresh({ onRefresh, children, threshold = 80 }) {
  const containerRef = useRef(null);
  const startY = useRef(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function onTouchStart(e) {
      // só ativa quando o scroll está no topo
      const scrollY = window.scrollY || document.documentElement.scrollTop || el.scrollTop;
      if (scrollY > 5) { startY.current = null; return; }
      startY.current = e.touches[0].clientY;
    }
    function onTouchMove(e) {
      if (startY.current == null || refreshing) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy > 0) {
        // amortece o movimento
        setPullDistance(Math.min(dy * 0.5, 140));
        if (dy > 10) e.preventDefault?.();
      }
    }
    async function onTouchEnd() {
      if (startY.current == null) return;
      if (pullDistance >= threshold) {
        setRefreshing(true);
        try { await onRefresh?.(); } finally { setRefreshing(false); }
      }
      startY.current = null;
      setPullDistance(0);
    }

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [onRefresh, threshold, pullDistance, refreshing]);

  const showPull = pullDistance > 0 || refreshing;

  return (
    <div ref={containerRef} className="relative">
      {showPull ? (
        <div
          className="pointer-events-none absolute left-0 right-0 top-0 flex justify-center"
          style={{ transform: `translateY(${Math.min(pullDistance, 80)}px)`, transition: refreshing ? "transform .15s ease" : "none" }}
        >
          <div className={`mt-2 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-md ${refreshing ? "animate-pulse" : ""}`}>
            <FaSync className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Atualizando..." : pullDistance >= threshold ? "Solte para atualizar" : "Puxe para atualizar"}
          </div>
        </div>
      ) : null}
      <div style={{ transform: `translateY(${refreshing ? 50 : pullDistance * 0.5}px)`, transition: refreshing ? "transform .15s ease" : "none" }}>
        {children}
      </div>
    </div>
  );
}
