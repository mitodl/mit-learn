import { renderHook, act } from "@/test-utils"
import { useDashboardLanguagePicker } from "./useDashboardLanguagePicker"
import type { SimpleSelectOption } from "ol-components"

const en: SimpleSelectOption = { value: "language:en", label: "English" }
const fr: SimpleSelectOption = { value: "language:fr", label: "French" }
const de: SimpleSelectOption = { value: "language:de", label: "German" }

describe("useDashboardLanguagePicker", () => {
  test("returns empty string when availableLanguages is empty", () => {
    const { result } = renderHook(() => useDashboardLanguagePicker([]))
    expect(result.current.selectedLanguageKey).toBe("")
  })

  test("defaults to first option's value when no user pick has been made", () => {
    const { result } = renderHook(() =>
      useDashboardLanguagePicker([en, fr, de]),
    )
    expect(result.current.selectedLanguageKey).toBe(String(en.value))
  })

  test("returns the user-picked value when it is present in options", () => {
    const { result } = renderHook(() =>
      useDashboardLanguagePicker([en, fr, de]),
    )
    act(() => {
      result.current.setSelectedLanguageKey(String(fr.value))
    })
    expect(result.current.selectedLanguageKey).toBe(String(fr.value))
  })

  test("falls back to first option when picked value is no longer in options after rerender", () => {
    let options = [en, fr, de]
    const { result, rerender } = renderHook(() =>
      useDashboardLanguagePicker(options),
    )
    act(() => {
      result.current.setSelectedLanguageKey(String(fr.value))
    })
    expect(result.current.selectedLanguageKey).toBe(String(fr.value))

    // Remove fr from options
    options = [en, de]
    rerender()
    expect(result.current.selectedLanguageKey).toBe(String(en.value))
  })

  test("persists the user pick when it is still present in updated options", () => {
    let options = [en, fr, de]
    const { result, rerender } = renderHook(() =>
      useDashboardLanguagePicker(options),
    )
    act(() => {
      result.current.setSelectedLanguageKey(String(fr.value))
    })

    // Add a new option but keep fr
    options = [en, fr, de, { value: "language:zh", label: "Chinese" }]
    rerender()
    expect(result.current.selectedLanguageKey).toBe(String(fr.value))
  })

  test("returns empty string when options go from non-empty to empty after rerender", () => {
    let options = [en, fr]
    const { result, rerender } = renderHook(() =>
      useDashboardLanguagePicker(options),
    )
    act(() => {
      result.current.setSelectedLanguageKey(String(fr.value))
    })
    expect(result.current.selectedLanguageKey).toBe(String(fr.value))

    options = []
    rerender()
    expect(result.current.selectedLanguageKey).toBe("")
  })
})
