import React from "react"
import type {
  CourseRunV2,
  CourseWithCourseRunsSerializerV2,
} from "@mitodl/mitxonline-api-axios/v2"
import { canPurchaseRun } from "@/common/mitxonline"
import { useCourseEnrollment } from "./useCourseEnrollment"
import { useCertificatePricing } from "./useCertificatePricing"
import EnrollOfferingBoxes from "./EnrollOfferingBoxes"

type CourseEnrollAreaProps = {
  course: CourseWithCourseRunsSerializerV2
  selectedRun: CourseRunV2 | undefined
}

const CourseEnrollArea: React.FC<CourseEnrollAreaProps> = ({
  course,
  selectedRun,
}) => {
  const [anchor, setAnchor] = React.useState<null | HTMLButtonElement>(null)

  const { state, scenario, isStatusLoading, isPending, isError } =
    useCourseEnrollment(course, selectedRun, {
      tracking: { placement: "infobox" },
      onRequireSignup: setAnchor,
    })

  const { price, showsRange, financialAid, breakdown } = useCertificatePricing(
    course,
    selectedRun?.products?.[0],
    { purchasable: selectedRun ? canPurchaseRun(selectedRun) : false },
  )

  // Show the in-card "Certificate deadline passed" note in both degraded
  // states (deadlinePassed and archived), but only when the run actually
  // offered a certificate — an audit-only archived run had no deadline to pass.
  const certificateDeadlineNote =
    scenario.status !== "active" && scenario.offeredCertificate

  return (
    <EnrollOfferingBoxes
      offering={scenario.offering}
      state={state}
      isStatusLoading={isStatusLoading}
      isPending={isPending}
      isError={isError}
      price={price}
      compactPrice={showsRange}
      financialAid={financialAid}
      breakdown={breakdown}
      productNoun="course"
      certificateDeadlineNote={certificateDeadlineNote}
      anchor={anchor}
      onAnchorClose={() => setAnchor(null)}
    />
  )
}

export default CourseEnrollArea
