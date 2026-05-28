import { act } from "@/test-utils"
import { renderHook } from "@testing-library/react"
import {
  LanguageEnum,
  type SupportedVariant,
} from "@mitodl/mitxonline-api-axios/v2"
import { useDashboardVariantPicker } from "./useDashboardVariantPicker"

const makeVariant = (
  overrides: Partial<SupportedVariant> = {},
): SupportedVariant => ({
  language: LanguageEnum.En,
  variant_industry: "",
  variant_length: "",
  active: true,
  b2b_only: true,
  default_variant: false,
  ...overrides,
})

const enVariant = makeVariant({
  language: LanguageEnum.En,
  default_variant: true,
})
const esVariant = makeVariant({
  language: LanguageEnum.EsEs,
  default_variant: false,
})
const frVariant = makeVariant({
  language: LanguageEnum.Fr,
  default_variant: false,
})

describe("useDashboardVariantPicker", () => {
  test("returns null when no variants are available", () => {
    const { result } = renderHook(() => useDashboardVariantPicker([]))
    expect(result.current.selectedVariant).toBeNull()
  })

  test("defaults to the variant with default_variant=true", () => {
    const { result } = renderHook(() =>
      useDashboardVariantPicker([esVariant, frVariant, enVariant]),
    )
    // enVariant is last but has default_variant: true
    expect(result.current.selectedVariant).toBe(enVariant)
  })

  test("defaults to first variant when none has default_variant=true", () => {
    const first = makeVariant({ language: LanguageEnum.Fr })
    const second = makeVariant({ language: LanguageEnum.EsEs })
    const { result } = renderHook(() =>
      useDashboardVariantPicker([first, second]),
    )
    expect(result.current.selectedVariant).toBe(first)
  })

  test("returns the user-picked variant when it is still in the list", () => {
    const { result } = renderHook(() =>
      useDashboardVariantPicker([enVariant, esVariant, frVariant]),
    )
    act(() => {
      result.current.setSelectedVariant(esVariant)
    })
    expect(result.current.selectedVariant).toBe(esVariant)
  })

  test("persists the user pick when options are updated but pick is still present", () => {
    let options = [enVariant, esVariant, frVariant]
    const { result, rerender } = renderHook(() =>
      useDashboardVariantPicker(options),
    )
    act(() => {
      result.current.setSelectedVariant(esVariant)
    })
    expect(result.current.selectedVariant).toBe(esVariant)

    const deVariant = makeVariant({ language: LanguageEnum.De })
    options = [enVariant, esVariant, frVariant, deVariant]
    rerender()
    expect(result.current.selectedVariant).toBe(esVariant)
  })

  test("falls back to default_variant entry when picked variant is removed on rerender", () => {
    let options = [enVariant, esVariant, frVariant]
    const { result, rerender } = renderHook(() =>
      useDashboardVariantPicker(options),
    )
    act(() => {
      result.current.setSelectedVariant(esVariant)
    })
    expect(result.current.selectedVariant).toBe(esVariant)

    // Remove esVariant; enVariant is still present and has default_variant: true
    options = [enVariant, frVariant]
    rerender()
    expect(result.current.selectedVariant).toBe(enVariant)
  })

  test("falls back to first variant when picked variant is removed and no default_variant exists", () => {
    const a = makeVariant({ language: LanguageEnum.En })
    const b = makeVariant({ language: LanguageEnum.EsEs })
    const c = makeVariant({ language: LanguageEnum.Fr })
    let options = [a, b, c]
    const { result, rerender } = renderHook(() =>
      useDashboardVariantPicker(options),
    )
    act(() => {
      result.current.setSelectedVariant(b)
    })
    expect(result.current.selectedVariant).toBe(b)

    options = [a, c]
    rerender()
    expect(result.current.selectedVariant).toBe(a)
  })

  test("returns null after rerender when variant list goes empty", () => {
    let options = [enVariant, esVariant]
    const { result, rerender } = renderHook(() =>
      useDashboardVariantPicker(options),
    )
    act(() => {
      result.current.setSelectedVariant(esVariant)
    })
    expect(result.current.selectedVariant).toBe(esVariant)

    options = []
    rerender()
    expect(result.current.selectedVariant).toBeNull()
  })

  test("setSelectedVariant(null) clears the explicit pick and reverts to default", () => {
    const { result } = renderHook(() =>
      useDashboardVariantPicker([enVariant, esVariant]),
    )
    act(() => {
      result.current.setSelectedVariant(esVariant)
    })
    expect(result.current.selectedVariant).toBe(esVariant)

    act(() => {
      result.current.setSelectedVariant(null)
    })
    // No explicit pick — falls back to default_variant: true
    expect(result.current.selectedVariant).toBe(enVariant)
  })
})
