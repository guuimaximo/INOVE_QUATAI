import { createContext, useCallback, useContext, useMemo, useState } from "react";

const MobileTabBadgesContext = createContext({
  badges: {},
  setBadges: () => {},
});

export function MobileTabBadgesProvider({ children }) {
  const [badges, setBadgesState] = useState({});
  const setBadges = useCallback((next) => {
    setBadgesState((current) => {
      const incoming = typeof next === "function" ? next(current) : next;
      if (!incoming) return {};
      // shallow compare to avoid extra re-renders
      const keys = new Set([...Object.keys(current), ...Object.keys(incoming)]);
      let changed = false;
      for (const k of keys) {
        if ((current[k] || 0) !== (incoming[k] || 0)) {
          changed = true;
          break;
        }
      }
      return changed ? { ...incoming } : current;
    });
  }, []);
  const value = useMemo(() => ({ badges, setBadges }), [badges, setBadges]);
  return <MobileTabBadgesContext.Provider value={value}>{children}</MobileTabBadgesContext.Provider>;
}

export function useMobileTabBadges() {
  return useContext(MobileTabBadgesContext);
}
