import React from "react"
import { Alert } from "@mitodl/smoot-design"
import type {
  CourseRunV2,
  CourseWithCourseRunsSerializerV2,
} from "@mitodl/mitxonline-api-axios/v2"
import { SignupPopover } from "@/page-components/SignupPopover/SignupPopover"
import { useCourseEnrollment } from "./useCourseEnrollment"
import { useCertificatePrice } from "./useCertificatePrice"
import CertificateTrackCard from "./CertificateTrackCard"
import LearnForFreeCard from "./LearnForFreeCard"
import EnrolledLink from "./EnrolledLink"
import { EnrollButton, OfferingCell, ChooseYourPath } from "./EnrollAreaParts"

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
      onRequireSignup: (el) => setAnchor(el),
    })

  const { price, financialAid } = useCertificatePrice(course, selectedRun)

  if (state.status === "none") {
    return null
  }

  if (state.status === "enrolled") {
    // Wrap in OfferingCell so the link sits at the top of its grid cell at its
    // natural height. As a bare grid child it would otherwise stretch to match
    // the (taller) metadata column in the tablet side-by-side layout.
    return (
      <OfferingCell data-card="enrolled">
        <EnrolledLink variant="primary" href={state.href} />
      </OfferingCell>
    )
  }

  // state.status === "options"
  const options = state.options
  const paidAction = options.find((o) => o.kind === "paid")
  const freeAction = options.find((o) => o.kind === "free")

  const renderPaidBox = () => {
    if (!paidAction) return null
    if (scenario.offering === "both") {
      // Button inside card. fill: match the free card's height in the
      // side-by-side layout and bottom-align the button.
      return (
        <OfferingCell data-card="cert">
          <CertificateTrackCard
            price={price}
            financialAid={financialAid}
            productNoun="course"
            fill
            action={
              <EnrollButton
                action={paidAction}
                size="medium"
                loading={isStatusLoading}
                pending={isPending}
                fullWidth
              />
            }
          />
        </OfferingCell>
      )
    }
    // paidOnly: card + button below, wrapped as one grid cell
    return (
      <OfferingCell data-card="cert">
        <CertificateTrackCard
          price={price}
          financialAid={financialAid}
          productNoun="course"
        />
        <EnrollButton
          action={paidAction}
          size="large"
          loading={isStatusLoading}
          pending={isPending}
          fullWidth
        />
      </OfferingCell>
    )
  }

  const renderFreeBox = () => {
    if (!freeAction) return null

    // Show the in-card "Certificate deadline passed" note in both degraded
    // states (deadlinePassed and archived), but only when the run actually
    // offered a certificate — an audit-only archived run had no deadline to pass.
    const deadlineNote =
      scenario.status !== "active" && scenario.offeredCertificate

    if (scenario.offering === "both") {
      // Button inside card. Secondary (outline) only here, to distinguish it
      // from the primary Certificate Track button alongside it.
      return (
        <OfferingCell data-card="free">
          <LearnForFreeCard
            productNoun="course"
            fill
            action={
              <EnrollButton
                action={freeAction}
                size="medium"
                loading={isStatusLoading}
                pending={isPending}
                variant="secondary"
                fullWidth
              />
            }
          />
        </OfferingCell>
      )
    }
    // freeOnly / deadlinePassed / archived: card + button below, wrapped as one
    // grid cell. The lone action is primary (filled).
    return (
      <OfferingCell data-card="free">
        <LearnForFreeCard
          productNoun="course"
          certificateDeadlineNote={deadlineNote}
        />
        <EnrollButton
          action={freeAction}
          size="large"
          loading={isStatusLoading}
          pending={isPending}
          fullWidth
        />
      </OfferingCell>
    )
  }

  return (
    <>
      {scenario.offering === "both" && (
        <ChooseYourPath data-choose-path>Choose Your Path</ChooseYourPath>
      )}
      {renderPaidBox()}
      {renderFreeBox()}
      {isError && (
        <Alert severity="error">
          There was a problem processing your enrollment. Please try again.
        </Alert>
      )}
      <SignupPopover anchorEl={anchor} onClose={() => setAnchor(null)} />
    </>
  )
}

export default CourseEnrollArea
