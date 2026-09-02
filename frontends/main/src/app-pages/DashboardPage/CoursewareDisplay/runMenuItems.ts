import NiceModal from "@ebay/nice-modal-react"
import type { SimpleMenuItem } from "ol-components"
import type { CourseRunEnrollmentV3 } from "@mitodl/mitxonline-api-axios/v2"
import { receiptByRunView } from "@/common/urls"
import { EmailSettingsDialog, UnenrollDialog } from "./DashboardDialogs"
import { getReceiptMenuItem } from "./receiptMenuItem"
import type { OrderIdResolution } from "@/common/mitxonline/useOrderIdForResource"

/**
 * The actions that belong to one course run, used by both the card menu and the
 * per-run rows of the sibling-runs accordion. Shared because every item here is
 * scoped to a single enrollment: a learner in several runs of one course needs
 * these against the run they picked, not whichever run the card displays.
 *
 * "View Course Details" is deliberately absent — it is the same page for every
 * run, so the card adds it once rather than repeating it on each row.
 */
const getRunMenuItems = ({
  enrollment,
  title,
  receiptResolution,
}: {
  enrollment: CourseRunEnrollmentV3
  title: string
  receiptResolution: OrderIdResolution
}): SimpleMenuItem[] => {
  const items: SimpleMenuItem[] = [
    {
      className: "dashboard-card-menu-item",
      key: "email-settings",
      label: "Email Settings",
      onClick: () => {
        NiceModal.show(EmailSettingsDialog, { title, enrollment })
      },
    },
    {
      className: "dashboard-card-menu-item",
      key: "unenroll",
      label: "Unenroll",
      onClick: () => {
        NiceModal.show(UnenrollDialog, { title, enrollment })
      },
    },
  ]

  const receiptMenuItem = getReceiptMenuItem(
    receiptResolution,
    receiptByRunView(enrollment.run.id),
  )
  if (receiptMenuItem) items.push(receiptMenuItem)

  return items
}

export { getRunMenuItems }
