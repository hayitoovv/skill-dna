import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { dictionary, type MessageKey } from "./messages";

/** UI languages (architecture section 11: Uzbek, Russian, English). */
export type Lang = "uz" | "ru" | "en";
export const LANGS: { code: Lang; label: string }[] = [
  { code: "uz", label: "O‘zbek" },
  { code: "ru", label: "Русский" },
  { code: "en", label: "English" },
];

const STORAGE_KEY = "skill_dna_lang";

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "uz" || saved === "ru" || saved === "en") return saved;
  } catch {}
  const nav = typeof navigator !== "undefined" ? navigator.language.slice(0, 2) : "uz";
  return nav === "ru" ? "ru" : nav === "en" ? "en" : "uz";
}

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (key: MessageKey, vars?: Record<string, string | number>) => string };

const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {}
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const t = useCallback(
    (key: MessageKey, vars?: Record<string, string | number>) => {
      const entry = dictionary[key];
      let text: string = entry ? entry[lang] ?? entry.uz : key;
      if (vars) for (const [k, v] of Object.entries(vars)) text = text.split(`{${k}}`).join(String(v));
      return text;
    },
    [lang]
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): Ctx {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { lang, setLang } = useI18n();
  return (
    <div role="group" aria-label="Til / Язык / Language" style={{ display: "inline-flex", gap: 2, padding: 3, borderRadius: 10, background: "var(--surface-3)", boxShadow: "var(--nm-inset)" }}>
      {LANGS.map((l) => (
        <button
          key={l.code}
          type="button"
          onClick={() => setLang(l.code)}
          aria-pressed={lang === l.code}
          title={l.label}
          style={{
            border: 0,
            borderRadius: 8,
            padding: compact ? "4px 7px" : "5px 9px",
            fontSize: 11.5,
            fontWeight: 700,
            cursor: "pointer",
            color: lang === l.code ? "var(--navy)" : "var(--muted)",
            background: lang === l.code ? "#fff" : "transparent",
            boxShadow: lang === l.code ? "0 2px 0 #dde4ed" : "none",
          }}
        >
          {l.code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
