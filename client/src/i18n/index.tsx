import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  TRANSLATIONS,
  LANGUAGES,
  DEFAULT_LANGUAGE,
  type LanguageCode,
} from "./translations";

const STORAGE_KEY = "youssef.lang";

type I18nContextValue = {
  lang: LanguageCode;
  setLang: (code: LanguageCode) => void;
  t: (key: string, fallback?: string) => string;
  dir: "ltr" | "rtl";
};

const I18nContext = createContext<I18nContextValue | null>(null);

function detectInitialLang(): LanguageCode {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE;
  const stored = window.localStorage.getItem(STORAGE_KEY) as LanguageCode | null;
  if (stored && LANGUAGES.some((l) => l.code === stored)) return stored;
  const browser = window.navigator?.language?.slice(0, 2).toLowerCase();
  const match = LANGUAGES.find((l) => l.code === browser);
  return match ? (match.code as LanguageCode) : DEFAULT_LANGUAGE;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<LanguageCode>(DEFAULT_LANGUAGE);

  useEffect(() => {
    setLangState(detectInitialLang());
  }, []);

  useEffect(() => {
    const meta = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0];
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
      document.documentElement.dir = meta.dir;
    }
  }, [lang]);

  const setLang = (code: LanguageCode) => {
    setLangState(code);
    try {
      window.localStorage.setItem(STORAGE_KEY, code);
    } catch {
      /* storage unavailable */
    }
  };

  const value = useMemo<I18nContextValue>(() => {
    const meta = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0];
    const dict = TRANSLATIONS[lang] ?? {};
    const fallbackDict = TRANSLATIONS[DEFAULT_LANGUAGE];
    return {
      lang,
      setLang,
      dir: meta.dir,
      t: (key: string, fallback?: string) =>
        dict[key] ?? fallbackDict[key] ?? fallback ?? key,
    };
  }, [lang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Safe fallback: returns the key when called outside the provider so
    // components can still render during early bootstrap / Storybook / tests.
    return {
      lang: DEFAULT_LANGUAGE,
      setLang: () => {},
      dir: "ltr" as const,
      t: (key: string, fallback?: string) =>
        TRANSLATIONS[DEFAULT_LANGUAGE][key] ?? fallback ?? key,
    };
  }
  return ctx;
}

export { LANGUAGES, DEFAULT_LANGUAGE };
export type { LanguageCode };
