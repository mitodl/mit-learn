import React from "react"
import { LoadingSpinner, Stack } from "ol-components"
import {
  enrollmentQueries,
  useCreateProgramEnrollment,
} from "api/mitxonline-hooks/enrollment"
import { useQuery } from "@tanstack/react-query"
import { V2ProgramDetail } from "@mitodl/mitxonline-api-axios/v2"
import { RiCheckLine } from "@remixicon/react"
import {
  Alert,
  Button,
  ButtonLink,
  styled,
  ButtonProps,
} from "@mitodl/smoot-design"
import ProgramEnrollmentDialog from "@/page-components/EnrollmentDialogs/ProgramEnrollmentDialog"
import NiceModal from "@ebay/nice-modal-react"
import { userQueries } from "api/hooks/user"
import { SignupPopover } from "@/page-components/SignupPopover/SignupPopover"
import { programView } from "@/common/urls"
import { usePostHog } from "posthog-js/react"
import {
  enrollmentAlertSuccessUrl,
  formatPrice,
  getEnrollmentType,
} from "@/common/mitxonline"
import { useReplaceBasketItem } from "api/mitxonline-hooks/baskets"
import { useRouter } from "next-nprogress-bar"
import { PostHogEvents } from "@/common/constants"

const ButtonLinkWithDisabled = styled(ButtonLink)(({ href }) => [
  !href && {
    pointerEvents: "none",
    cursor: "default",
  },
])

type ProgramEnrollmentButtonProps = {
  program: V2ProgramDetail
  variant?: ButtonProps["variant"]
  className?: string
  displayAsCourse?: boolean
}
const ProgramEnrollmentButton: React.FC<ProgramEnrollmentButtonProps> = ({
  program,
  variant = "primary",
  className,
  displayAsCourse,
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
  const posthog = usePostHog()

  const handleClick: React.MouseEventHandler<HTMLButtonElement> = (e) => {
    if (enrollments.isLoading || me.isLoading) {
      return
    }
    if (process.env.NEXT_PUBLIC_POSTHOG_API_KEY) {
      posthog.capture(PostHogEvents.CallToActionClicked, {
        readableId: program.readable_id,
        resourceType: "program",
        label: getEnrollButtonText(),
      })
    }
    if (me.data?.is_authenticated) {
      if (enrollmentType === "paid" && program.products[0]) {
        replaceBasketItem.mutate(program.products[0].id)
      } else if (enrollmentType === "free") {
        createProgramEnrollment.mutate(
          { V3ProgramEnrollmentRequestRequest: { program_id: program.id } },
          {
            onSuccess: () => {
              router.push(
                enrollmentAlertSuccessUrl({
                  title: program.title ?? "your enrollment",
                }),
              )
            },
          },
        )
      } else {
        NiceModal.show(ProgramEnrollmentDialog, { program, displayAsCourse })
      }
    } else {
      setAnchor(e.currentTarget)
    }
  }
  const href = programView(program.id)

  return (
    <>
      <Stack gap="12px">
        {enrollment ? (
          <ButtonLinkWithDisabled
            variant={variant}
            size="large"
            href={href}
            className={className}
          >
            Enrolled
            <RiCheckLine aria-hidden="true" />
          </ButtonLinkWithDisabled>
        ) : (
          <Button
            onClick={handleClick}
            variant={variant}
            size="large"
            className={className}
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
