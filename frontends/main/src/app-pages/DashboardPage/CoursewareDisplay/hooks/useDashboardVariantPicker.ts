import { useState } from "react"
import {
  DEFAULT_VARIANT_OPTION,
  type ContractVariantOption,
} from "../model/variantOptions"

type DashboardVariantPicker = {
  selectedVariant: ContractVariantOption
  setSelectedVariantValue: (value: string) => void
}

/**
 * Manages the selected variant state for the B2B contract dashboard picker.
 *
 * Defaults to the first available option (always "Original" / the default
 * variant). Validates the stored selection against the current option list on
 * each render, falling back to the first option if the picked value is no
 * longer present.
 */
const useDashboardVariantPicker = (
  availableVariants: ContractVariantOption[],
): DashboardVariantPicker => {
  const [pickedValue, setPickedValue] = useState<string | null>(null)

  const selectedVariant =
    (pickedValue !== null
      ? availableVariants.find((o) => o.value === pickedValue)
      : null) ??
    availableVariants[0] ??
    DEFAULT_VARIANT_OPTION

  return { selectedVariant, setSelectedVariantValue: setPickedValue }
}

export { useDashboardVariantPicker }
export type { DashboardVariantPicker }
