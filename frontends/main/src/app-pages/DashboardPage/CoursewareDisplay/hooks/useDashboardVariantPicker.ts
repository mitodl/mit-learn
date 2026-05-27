import { useState } from "react"
import type { SupportedVariant } from "@mitodl/mitxonline-api-axios/v2"
import { buildVariantKey } from "../model/variantOptions"

type DashboardVariantPicker = {
  selectedVariant: SupportedVariant | null
  setSelectedVariantValue: (value: string) => void
}

/**
 * Manages the selected variant state for the B2B contract dashboard picker.
 *
 * `null` means "Original" (show each course's default run).
 * Defaults to null. Falls back to null if the stored value no longer matches
 * any available variant (e.g. after course list changes).
 */
const useDashboardVariantPicker = (
  availableVariants: SupportedVariant[],
): DashboardVariantPicker => {
  const [pickedValue, setPickedValue] = useState<string | null>(null)

  const selectedVariant =
    pickedValue !== null && pickedValue !== ""
      ? (availableVariants.find(
          (v) =>
            buildVariantKey(
              v.language ?? "",
              (v.variant_industry as string) ?? "",
              (v.variant_length as string) ?? "",
            ) === pickedValue,
        ) ?? null)
      : null

  return { selectedVariant, setSelectedVariantValue: setPickedValue }
}

export { useDashboardVariantPicker }
export type { DashboardVariantPicker }
