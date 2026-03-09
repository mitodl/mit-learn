import React from "react"
import { LoadingSpinner, Stack } from "ol-components"
import {
  enrollmentQueries,
  useCreateProgramEnrollment,
} from "api/mitxonline-hooks/enrollment"
import { useQuery } from "@tanstack/react-query"
import { V2ProgramDetail } from "@mitodl/mitxonline-api-axios/v2"
import { RiCheckLine } from "@remixicon/react"
import { Alert, Button, ButtonLink } from "@mitodl/smoot-design"
import ProgramEnrollmentDialog from "@/page-components/EnrollmentDialogs/ProgramEnrollmentDialog"
import NiceModal from "@ebay/nice-modal-react"
import { userQueries } from "api/hooks/user"
import { SignupPopover } from "@/page-components/SignupPopover/SignupPopover"
import { programView, DASHBOARD_HOME } from "@/common/urls"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { FeatureFlags } from "@/common/feature_flags"
import { getEnrollmentType, formatPrice } from "@/common/mitxonline"
import { useReplaceBasketItem } from "api/mitxonline-hooks/baskets"
import { useRouter } from "next-nprogress-bar"

type ProgramEnrollmentButtonProps = {
  program: V2ProgramDetail
}
const ProgramEnrollmentButton: React.FC<ProgramEnrollmentButtonProps> = ({
  program,
}) => {
  const [anchor, setAnchor] = React.useState<null | HTMLButtonElement>(null)
  const me = useQuery(userQueries.me())
  const replaceBasketItem = useReplaceBasketItem()
  const createProgramEnrollment = useCreateProgramEnrollment()
  const router = useRouter()
  const enrollments = useQuery({
    ...enrollmentQueries.programEnrollmentsList(),
    throwOnError: false,
  })
  const programDashboardEnabled = useFeatureFlagEnabled(
    FeatureFlags.EnrollmentDashboard,
  )
  const enrollment =
    program && enrollments.data?.find((e) => e.program.id === program.id)

  const enrollmentType = getEnrollmentType(program.enrollment_modes)
  const isPaidWithoutPrice =
    enrollmentType === "paid" && !program.products[0]?.price

  const getEnrollButtonText = () => {
    if (enrollmentType === "paid") {
      const price = program.products[0]?.price
      return price
        ? `Enroll Now—${formatPrice(price, { avoidCents: true })}`
        : "Enroll Now"
    }
    return "Enroll for Free"
  }

  const isLoading = enrollments.isLoading || me.isLoading
  const isPending =
    replaceBasketItem.isPending || createProgramEnrollment.isPending
  const isError = replaceBasketItem.isError || createProgramEnrollment.isError

  const handleClick: React.MouseEventHandler<HTMLButtonElement> = (e) => {
    if (enrollments.isLoading || me.isLoading) {
      return
    } else if (me.data?.is_authenticated) {
      if (enrollmentType === "paid" && program.products[0]) {
        replaceBasketItem.mutate(program.products[0].id)
      } else if (enrollmentType === "free") {
        createProgramEnrollment.mutate(
          { V3ProgramEnrollmentRequestRequest: { program_id: program.id } },
          { onSuccess: () => router.push(DASHBOARD_HOME) },
        )
      } else {
        NiceModal.show(ProgramEnrollmentDialog, { program })
      }
    } else {
      setAnchor(e.currentTarget)
    }
  }
  const href = programDashboardEnabled ? programView(program.id) : undefined

  return (
    <>
      <Stack gap="12px">
        {enrollment ? (
          <ButtonLink href={href}>
            Enrolled
            <RiCheckLine aria-hidden="true" />
          </ButtonLink>
        ) : (
          <Button
            onClick={handleClick}
            variant="primary"
            size="large"
            disabled={
              enrollmentType === "none" ||
              isPaidWithoutPrice ||
              isPending ||
              isLoading
            }
            endIcon={
              isLoading || isPending ? (
                <LoadingSpinner size="16px" loading={true} color="inherit" />
              ) : undefined
            }
          >
            {isLoading ? null : getEnrollButtonText()}
          </Button>
        )}
        {isError && (
          <Alert severity="error">
            There was a problem processing your enrollment. Please try again.
          </Alert>
        )}
      </Stack>
      <SignupPopover anchorEl={anchor} onClose={() => setAnchor(null)} />
    </>
  )
}

export default ProgramEnrollmentButton
