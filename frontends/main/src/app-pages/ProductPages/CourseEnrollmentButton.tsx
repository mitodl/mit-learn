import React from "react"
import { styled, Stack, LoadingSpinner } from "ol-components"
import { useQuery } from "@tanstack/react-query"
import {
  CourseRunV2,
  CourseWithCourseRunsSerializerV2,
} from "@mitodl/mitxonline-api-axios/v2"
import { Alert, Button } from "@mitodl/smoot-design"
import CourseEnrollmentDialog from "@/page-components/EnrollmentDialogs/CourseEnrollmentDialog"
import NiceModal from "@ebay/nice-modal-react"
import { userQueries } from "api/hooks/user"
import { SignupPopover } from "@/page-components/SignupPopover/SignupPopover"
import {
  canUpgradeRun,
  getEnrollmentType,
  priceWithDiscount,
} from "@/common/mitxonline"
import { productQueries } from "api/mitxonline-hooks/products"
import { useAddToBasket, useClearBasket } from "api/mitxonline-hooks/baskets"

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
}
const CourseEnrollmentButton: React.FC<CourseEnrollmentButtonProps> = ({
  course,
}) => {
  const [anchor, setAnchor] = React.useState<null | HTMLButtonElement>(null)
  const me = useQuery(userQueries.me())
  const addToBasket = useAddToBasket()
  const clearBasket = useClearBasket()
  const nextRunId = course.next_run_id
  const nextRun = course.courseruns.find((run) => run.id === nextRunId)

  const enrollmentType = getEnrollmentType(nextRun?.enrollment_modes)
  const product = nextRun?.products[0]
  const canPurchase = nextRun ? canUpgradeRun(nextRun) : false
  const hasFinancialAid = !!(
    course.page.financial_assistance_form_url && product
  )
  const userFlexiblePrice = useQuery({
    ...productQueries.userFlexiblePriceDetail({ productId: product?.id ?? 0 }),
    enabled: enrollmentType === "paid" && canPurchase && hasFinancialAid,
  })
  const price =
    enrollmentType === "paid" && product
      ? priceWithDiscount({ product, flexiblePrice: userFlexiblePrice.data })
      : null

  const isPaidWithoutPrice = enrollmentType === "paid" && !product?.price

  const isPending = clearBasket.isPending || addToBasket.isPending
  const isError = clearBasket.isError || addToBasket.isError

  const handleClick: React.MouseEventHandler<HTMLButtonElement> = async (e) => {
    if (me.isLoading) {
      return
    } else if (me.data?.is_authenticated) {
      if (enrollmentType === "paid" && product) {
        clearBasket.reset()
        addToBasket.reset()
        try {
          await clearBasket.mutateAsync()
          await addToBasket.mutateAsync(product.id)
        } catch {
          // errors reflected in clearBasket.isError / addToBasket.isError
        }
      } else {
        NiceModal.show(CourseEnrollmentDialog, { course })
      }
    } else {
      setAnchor(e.currentTarget)
    }
  }

  return (
    <>
      <Stack width="100%" gap="12px">
        <Button
          disabled={!nextRun || isPaidWithoutPrice || isPending}
          onClick={handleClick}
          variant="primary"
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
