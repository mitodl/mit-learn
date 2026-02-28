import React from "react"
import { styled, LoadingSpinner } from "ol-components"
import {
  enrollmentQueries,
  useCreateProgramEnrollment,
} from "api/mitxonline-hooks/enrollment"
import { useQuery } from "@tanstack/react-query"
import { V2ProgramDetail } from "@mitodl/mitxonline-api-axios/v2"
import { RiCheckLine } from "@remixicon/react"
import { Button, ButtonLink } from "@mitodl/smoot-design"
import ProgramEnrollmentDialog from "@/page-components/EnrollmentDialogs/ProgramEnrollmentDialog"
import NiceModal from "@ebay/nice-modal-react"
import { userQueries } from "api/hooks/user"
import { SignupPopover } from "@/page-components/SignupPopover/SignupPopover"
import { programView, DASHBOARD_HOME } from "@/common/urls"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { FeatureFlags } from "@/common/feature_flags"
import { getEnrollmentType } from "@/common/mitxonline"
import { useAddToBasket, useClearBasket } from "api/mitxonline-hooks/baskets"
import { useRouter } from "next-nprogress-bar"

const WideButton = styled(Button)({
  width: "100%",
})

const WideButtonLink = styled(ButtonLink)(({ href }) => [
  {
    width: "100%",
  },
  !href && {
    pointerEvents: "none",
    cursor: "default",
  },
])

type ProgramEnrollmentButtonProps = {
  program: V2ProgramDetail
}
const ProgramEnrollmentButton: React.FC<ProgramEnrollmentButtonProps> = ({
  program,
}) => {
  const [anchor, setAnchor] = React.useState<null | HTMLButtonElement>(null)
  const me = useQuery(userQueries.me())
  const addToBasket = useAddToBasket()
  const clearBasket = useClearBasket()
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
      return price ? `Enroll Now—$${price}` : "Enroll Now"
    }
    return "Enroll for Free"
  }

  const handleClick: React.MouseEventHandler<HTMLButtonElement> = async (e) => {
    if (enrollments.isLoading || me.isLoading) {
      return
    } else if (me.data?.is_authenticated) {
      if (enrollmentType === "paid" && program.products[0]) {
        const product = program.products[0]
        clearBasket.reset()
        addToBasket.reset()
        await clearBasket.mutateAsync()
        await addToBasket.mutateAsync(product.id)
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
  const isLoading = enrollments.isLoading || me.isLoading
  if (enrollment) {
    const href = programDashboardEnabled ? programView(program.id) : undefined

    return (
      <WideButtonLink href={href}>
        Enrolled
        <RiCheckLine aria-hidden="true" />
      </WideButtonLink>
    )
  }
  return (
    <>
      <WideButton
        onClick={handleClick}
        variant="primary"
        size="large"
        disabled={isPaidWithoutPrice}
      >
        {isLoading ? (
          <LoadingSpinner size="20px" loading={true} color="inherit" />
        ) : (
          getEnrollButtonText()
        )}
      </WideButton>
      <SignupPopover anchorEl={anchor} onClose={() => setAnchor(null)} />
    </>
  )
}

export default ProgramEnrollmentButton
