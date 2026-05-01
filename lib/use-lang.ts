"use client"

import { useState, useEffect, useCallback } from "react"
import type { Lang } from "./i18n"

const LANG_KEY = "ctt:lang"

export function useLang(): [Lang, (l: Lang) => void] {
  const [lang, setLangState] = useState<Lang>("en")

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LANG_KEY)
      if (stored === "nl" || stored === "en") setLangState(stored)
    } catch {}
  }, [])

  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    try { localStorage.setItem(LANG_KEY, l) } catch {}
  }, [])

  return [lang, setLang]
}
