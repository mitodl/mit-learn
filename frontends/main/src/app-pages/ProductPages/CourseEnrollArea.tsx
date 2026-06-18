import React from "react"
import { LoadingSpinner } from "ol-components"
import { Alert, Button, ButtonLink } from "@mitodl/smoot-design"
import { RiCheckLine } from "@remixicon/react"
import type {
  CourseRunV2,
  CourseWithCourseRunsSerializerV2,
} from "@mitodl/mitxonline-api-axios/v2"
import { SignupPopover } from "@/page-components/SignupPopover/SignupPopover"
import { useCourseEnrollment, type EnrollAction } from "./useCourseEnrollment"
import { useCertificatePrice } from "./useCertificatePrice"
import CertificateTrackCard from "./CertificateTrackCard"
import LearnForFreeCard from "./LearnForFreeCard"

type EnrollButtonProps = {
  action: EnrollAction
  size: "medium" | "large"
  loading: boolean
  pending: boolean
}

const EnrollButton: React.FC<EnrollButtonProps> = ({
  action,
  size,
  loading,
  pending,
}) => {
  const isBusy = loading || pending
  return (
    <span data-size={size}>
      <Button
        variant="primary"
        size={size}
        onClick={action.onClick}
        disabled={action.disabled || isBusy}
        aria-busy={isBusy}
        endIcon={
          isBusy ? (
            <LoadingSpinner size="16px" loading={true} color="inherit" />
          ) : undefined
        }
      >
        {isBusy ? null : action.label}
      </Button>
    </span>
  )
}

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
      onRequireSignup: (el) => setAnchor(el),
    })

  const { price, financialAid } = useCertificatePrice(course, selectedRun)

  if (state.status === "none") {
    return null
  }

  if (state.status === "enrolled") {
    return (
      <>
        <ButtonLink variant="primary" size="large" href={state.href}>
          Enrolled
          <RiCheckLine aria-hidden="true" />
        </ButtonLink>
        <SignupPopover anchorEl={anchor} onClose={() => setAnchor(null)} />
      </>
    )
  }

  // state.status === "options"
  const options = state.options
  const paidAction = options.find((o) => o.kind === "paid")
  const freeAction = options.find((o) => o.kind === "free")
  const accessAction = options.find((o) => o.kind === "access")

  const renderPaidBox = () => {
    if (!paidAction) return null
    if (scenario === "both") {
      // Button inside card
      return (
        <div data-card="cert">
          <CertificateTrackCard
            price={price}
            financialAid={financialAid}
            productNoun="course"
            action={
              <EnrollButton
                action={paidAction}
                size="medium"
                loading={isStatusLoading}
                pending={isPending}
              />
            }
          />
        </div>
      )
    }
    // paidOnly: card + button below
    return (
      <>
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
        />
      </>
    )
  }

  const renderFreeBox = () => {
    const freeOrAccess = freeAction ?? accessAction
    if (!freeOrAccess) return null

    const deadlineNote = scenario === "deadlinePassed"

    if (scenario === "both") {
      // Button inside card
      return (
        <div data-card="free">
          <LearnForFreeCard
            productNoun="course"
            action={
              <EnrollButton
                action={freeOrAccess}
                size="medium"
                loading={isStatusLoading}
                pending={isPending}
              />
            }
          />
        </div>
      )
    }
    // freeOnly / deadlinePassed / archived: card + button below
    return (
      <>
        <LearnForFreeCard
          productNoun="course"
          certificateDeadlineNote={deadlineNote}
        />
        <EnrollButton
          action={freeOrAccess}
          size="large"
          loading={isStatusLoading}
          pending={isPending}
        />
      </>
    )
  }

  return (
    <>
      {scenario === "both" && <div>Choose Your Path</div>}
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
