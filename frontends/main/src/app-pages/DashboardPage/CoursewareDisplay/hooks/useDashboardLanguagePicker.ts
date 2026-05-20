import { useState } from "react"
import type { SimpleSelectOption } from "ol-components"

type DashboardLanguagePicker = {
  selectedLanguageKey: string
  setSelectedLanguageKey: (key: string) => void
}

const useDashboardLanguagePicker = (
  availableLanguages: SimpleSelectOption[],
): DashboardLanguagePicker => {
  // store ONLY the raw user choice; derive the effective key (no effect)
  const [picked, setPicked] = useState<string | null>(null)
  const selectedLanguageKey =
    picked !== null &&
    availableLanguages.some((o) => String(o.value) === picked)
      ? picked
      : availableLanguages[0]
        ? String(availableLanguages[0].value)
        : ""
  return { selectedLanguageKey, setSelectedLanguageKey: setPicked }
}

export { useDashboardLanguagePicker }
export type { DashboardLanguagePicker }
