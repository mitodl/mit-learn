import { SimpleMenuItem } from "ol-components"
import {
  isVerifiedEnrollmentMode,
  mitxonlineLegacyUrl,
} from "@/common/mitxonline"

const getReceiptMenuItem = (
  enrollmentMode: string | null | undefined,
  receiptPath: string,
): SimpleMenuItem | null => {
  if (!enrollmentMode || !isVerifiedEnrollmentMode(enrollmentMode)) return null

  return {
    className: "dashboard-card-menu-item",
    key: "receipt",
    label: "Receipt",
    onClick: () => {
      window.open(
        mitxonlineLegacyUrl(receiptPath),
        "_blank",
        "noopener,noreferrer",
      )
    },
  }
}

export { getReceiptMenuItem }
