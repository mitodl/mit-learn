import React from "react"
import { LoadingSpinner } from "ol-components"
import { Alert, Button, styled, type ButtonProps } from "@mitodl/smoot-design"
import type {
  CourseRunV2,
  CourseWithCourseRunsSerializerV2,
} from "@mitodl/mitxonline-api-axios/v2"
import { SignupPopover } from "@/page-components/SignupPopover/SignupPopover"
import { useCourseEnrollment, type EnrollAction } from "./useCourseEnrollment"
import { useCertificatePrice } from "./useCertificatePrice"
import CertificateTrackCard from "./CertificateTrackCard"
import LearnForFreeCard from "./LearnForFreeCard"
import EnrolledLink from "./EnrolledLink"

const ChooseYourPath = styled.div(({ theme }) => ({
  ...theme.typography.subtitle2,
  fontWeight: theme.typography.fontWeightBold,
  color: theme.custom.colors.darkGray2,
}))

const ButtonWrapper = styled.span<{ $fullWidth?: boolean }>(({ $fullWidth }) =>
  $fullWidth
    ? { display: "block", width: "100%", "> button": { width: "100%" } }
    : { display: "inline-block" },
)

/**
 * One offering "box" as a grid cell: the card plus, in single-box scenarios,
 * the enrollment button below it. The 16px gap separates the card from a
 * below-the-card button (no-op in the Both case, where the button is inside
 * the card).
 */
const OfferingCell = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "16px",
})

export type EnrollButtonProps = {
  action: EnrollAction
  size: "medium" | "large"
  loading: boolean
  pending: boolean
  variant?: ButtonProps["variant"]
  announceStatus?: boolean
  fullWidth?: boolean
}

export const EnrollButton: React.FC<EnrollButtonProps> = ({
  action,
  size,
  loading,
  pending,
  variant = "primary",
  announceStatus = true,
  fullWidth = false,
}) => {
  const isBusy = loading || pending
  // While busy the label is hidden behind the spinner, so give the button an
  // accessible name rather than leaving it nameless (WCAG 4.1.2). "Loading" is
  // neutral — we intentionally avoid the action label here, which the
  // spinner-first design exists to hide.
  const busyProps = {
    ...(announceStatus ? { "aria-busy": isBusy } : {}),
    ...(isBusy ? { "aria-label": "Loading" } : {}),
  }
  return (
    <ButtonWrapper data-size={size} $fullWidth={fullWidth}>
      <Button
        variant={variant}
        size={size}
        onClick={action.onClick}
        disabled={isBusy}
        {...busyProps}
        endIcon={
          isBusy ? (
            // Hide the spinner from assistive tech — the button already conveys
            // busy via aria-busy + the "Loading" name, and would otherwise leak
            // a redundant role=progressbar named "Loading". LoadingSpinner does
            // not forward aria-hidden, so wrap it in an element that does.
            <span aria-hidden="true">
              <LoadingSpinner size="16px" loading={true} color="inherit" />
            </span>
          ) : undefined
        }
      >
        {isBusy ? null : action.label}
      </Button>
    </ButtonWrapper>
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
    return <EnrolledLink variant="primary" href={state.href} />
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
