import React from "react"
import { styled, Stack, LoadingSpinner } from "ol-components"
import { useQuery } from "@tanstack/react-query"
import {
  CourseRunV2,
  CourseWithCourseRunsSerializerV2,
} from "@mitodl/mitxonline-api-axios/v2"
import { Alert, Button, ButtonProps } from "@mitodl/smoot-design"
import CourseEnrollmentDialog from "@/page-components/EnrollmentDialogs/CourseEnrollmentDialog"
import NiceModal from "@ebay/nice-modal-react"
import { userQueries } from "api/hooks/user"
import { SignupPopover } from "@/page-components/SignupPopover/SignupPopover"
import {
  canPurchaseRun,
  dashboardEnrollmentSuccessUrl,
  getEnrollmentType,
  getCourseEnrollmentAction,
  priceWithDiscount,
} from "@/common/mitxonline"
import { productQueries } from "api/mitxonline-hooks/products"
import { useReplaceBasketItem } from "api/mitxonline-hooks/baskets"
import { useCreateEnrollment } from "api/mitxonline-hooks/enrollment"
import { useRouter } from "next-nprogress-bar"

const DiscountedPriceContent = styled.span({
  display: "inline-flex",
  alignItems: "baseline",
  gap: "0.25em",
})

const StrickenPrice = styled.span(({ theme }) => ({
  textDecoration: "line-through",
  opacity: 0.75,
  ...theme.typography.buttonSmall,
}))

const getButtonText = (nextRun?: CourseRunV2, priceDisplay?: string) => {
  if (!nextRun || nextRun.is_archived) {
    return "Access Course Materials"
  }
  const enrollmentType = getEnrollmentType(nextRun.enrollment_modes)
  if (enrollmentType === "paid") {
    return priceDisplay ? `Enroll Now—${priceDisplay}` : "Enroll Now"
  }
  return "Enroll for Free"
}

type CourseEnrollmentButtonProps = {
  course: CourseWithCourseRunsSerializerV2
  variant?: ButtonProps["variant"]
  className?: string
}
const CourseEnrollmentButton: React.FC<CourseEnrollmentButtonProps> = ({
  course,
  variant = "primary",
  className,
}) => {
  const [anchor, setAnchor] = React.useState<null | HTMLButtonElement>(null)
  const me = useQuery(userQueries.me())
  const replaceBasketItem = useReplaceBasketItem()
  const createEnrollment = useCreateEnrollment()
  const router = useRouter()
  const nextRunId = course.next_run_id
  const nextRun = course.courseruns.find((run) => run.id === nextRunId)
  const enrollmentDecision = getCourseEnrollmentAction(course)

  const enrollmentType = getEnrollmentType(nextRun?.enrollment_modes)
  const product = nextRun?.products[0]
  const canPurchase = nextRun ? canPurchaseRun(nextRun) : false
  const financialAidUrl = course?.page?.financial_assistance_form_url
  const hasFinancialAid = !!(financialAidUrl && product)
  const userFlexiblePrice = useQuery({
    ...productQueries.userFlexiblePriceDetail({ productId: product?.id ?? 0 }),
    enabled: enrollmentType === "paid" && canPurchase && hasFinancialAid,
  })
  const price =
    enrollmentType === "paid" && product
      ? priceWithDiscount({
          product,
          flexiblePrice: userFlexiblePrice.data,
          avoidCents: true,
        })
      : null

  const isPaidWithoutPrice = enrollmentType === "paid" && !product?.price

  const isPending = replaceBasketItem.isPending || createEnrollment.isPending
  const isError = replaceBasketItem.isError || createEnrollment.isError

  const handleClick: React.MouseEventHandler<HTMLButtonElement> = (e) => {
    if (me.isLoading) {
      return
    } else if (me.data?.is_authenticated) {
      if (enrollmentDecision.type === "dialog") {
        NiceModal.show(CourseEnrollmentDialog, { course })
      } else if (enrollmentDecision.type === "checkout") {
        replaceBasketItem.mutate(enrollmentDecision.product.id)
      } else if (enrollmentDecision.type === "audit") {
        createEnrollment.mutate(
          { run_id: enrollmentDecision.run.id },
          {
            onSuccess: () => {
              router.push(
                dashboardEnrollmentSuccessUrl({
                  title: course.title ?? "your enrollment",
                }),
              )
            },
          },
        )
      } else {
        NiceModal.show(CourseEnrollmentDialog, { course })
      }
    } else {
      setAnchor(e.currentTarget)
    }
  }

  return (
    <>
      <Stack gap="12px">
        <Button
          className={className}
          disabled={
            !nextRun ||
            enrollmentType === "none" ||
            isPaidWithoutPrice ||
            isPending
          }
          onClick={handleClick}
          variant={variant}
          size="large"
          data-testid="course-enrollment-button"
          endIcon={
            isPending ? (
              <LoadingSpinner size="16px" loading={true} color="inherit" />
            ) : undefined
          }
        >
          {price?.isDiscounted ? (
            <DiscountedPriceContent>
              <span>Enroll Now—{price.finalPrice}</span>
              <StrickenPrice>{price.originalPrice}</StrickenPrice>
            </DiscountedPriceContent>
          ) : (
            getButtonText(nextRun, price?.finalPrice)
          )}
        </Button>
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

export default CourseEnrollmentButton
