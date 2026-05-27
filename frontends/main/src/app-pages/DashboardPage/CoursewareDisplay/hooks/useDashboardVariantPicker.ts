import { useState } from "react"
import type { SupportedVariant } from "@mitodl/mitxonline-api-axios/v2"
import { buildVariantKey } from "../model/variantOptions"

type DashboardVariantPicker = {
  selectedVariant: SupportedVariant | null
  setSelectedVariant: (variant: SupportedVariant | null) => void
}

/**
 * Manages the selected variant state for the B2B contract dashboard picker.
 *
 * Defaults to the upstream-provided default variant when available, otherwise
 * the first variant in the list.
 */
const useDashboardVariantPicker = (
  availableVariants: SupportedVariant[],
): DashboardVariantPicker => {
  const [pickedValue, setPickedValue] = useState<string | null>(null)

  const selectedVariant =
    availableVariants.find((variant) => {
      const variantKey = buildVariantKey(
        variant.language ?? "",
        (variant.variant_industry as string) ?? "",
        (variant.variant_length as string) ?? "",
      )
      return variantKey === pickedValue
    }) ??
    availableVariants.find((variant) => variant.default_variant) ??
    availableVariants[0] ??
    null

  const setSelectedVariant = (variant: SupportedVariant | null) => {
    if (variant === null) {
      setPickedValue(null)
      return
    }

    setPickedValue(
      buildVariantKey(
        variant.language ?? "",
        (variant.variant_industry as string) ?? "",
        (variant.variant_length as string) ?? "",
      ),
    )
  }

  return { selectedVariant, setSelectedVariant }
}

export { useDashboardVariantPicker }
export type { DashboardVariantPicker }
