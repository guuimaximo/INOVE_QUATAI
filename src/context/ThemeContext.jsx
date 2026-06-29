import { createContext, useContext, useEffect, useState } from "react";

// Cores do "chrome" principal (sidebar + acentos da top bar/botoes). O usuario
// escolhe na tela de Preferencias; aplicamos via variaveis CSS no root, entao
// qualquer surface que use var(--inove-sidebar)/var(--inove-accent) recolore.
export const THEMES = [
  { key: "azul", label: "Azul", sidebar: "#1d4ed8", accent: "#2563eb" },
  { key: "indigo", label: "Índigo", sidebar: "#4338ca", accent: "#4f46e5" },
  { key: "roxo", label: "Roxo", sidebar: "#6d28d9", accent: "#7c3aed" },
  { key: "verde", label: "Verde", sidebar: "#047857", accent: "#059669" },
  { key: "petroleo", label: "Petróleo", sidebar: "#0f766e", accent: "#0d9488" },
  { key: "grafite", label: "Grafite", sidebar: "#334155", accent: "#475569" },
  { key: "vinho", label: "Vinho", sidebar: "#9f1239", accent: "#be123c" },
  { key: "laranja", label: "Laranja", sidebar: "#c2410c", accent: "#ea580c" },
];

const DEFAULT = THEMES[0];
const STORAGE_KEY = "inove_theme";
const ThemeContext = createContext(null);

function applyTheme(theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("--inove-sidebar", theme.sidebar);
  root.style.setProperty("--inove-accent", theme.accent);
}

export function ThemeProvider({ children }) {
  const [themeKey, setThemeKey] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || DEFAULT.key;
    } catch {
      return DEFAULT.key;
    }
  });

  useEffect(() => {
    const theme = THEMES.find((t) => t.key === themeKey) || DEFAULT;
    applyTheme(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme.key);
    } catch {
      // sem storage: tema vive so na sessao
    }
  }, [themeKey]);

  return (
    <ThemeContext.Provider value={{ themeKey, setThemeKey, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme deve ser usado dentro de ThemeProvider.");
  return ctx;
}
