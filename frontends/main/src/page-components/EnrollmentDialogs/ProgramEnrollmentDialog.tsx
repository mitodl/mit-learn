import React from "react"
import { Stack, Typography } from "ol-components"
import NiceModal, { muiDialogV5 } from "@ebay/nice-modal-react"
import { V2ProgramDetail } from "@mitodl/mitxonline-api-axios/v2"
import { useReplaceBasketItem } from "@/common/mitxonline/useReplaceBasketItem"
import { useCreateProgramEnrollment } from "api/mitxonline-hooks/enrollment"
import { useRouter } from "next-nprogress-bar"
import {
  enrollmentAlertSuccessUrl,
  formatPrice,
  getEnrollmentType,
  mitxonlineLegacyUrl,
  priceWithDiscount,
} from "@/common/mitxonline"
import {
  BigButton,
  CertificateBox,
  CertificatePriceRoot,
  CertificateReasonItem,
  CertificateReasonsList,
  StyledFormDialog,
  StrickenText,
  UnderlinedLink,
} from "./CourseEnrollmentDialog"
import { RiArrowRightLine, RiAwardFill, RiCheckLine } from "@remixicon/react"
import { Alert } from "@mitodl/smoot-design"
import { useQuery } from "@tanstack/react-query"
import { productQueries } from "api/mitxonline-hooks/products"
import { useUserIsAuthenticated } from "api/hooks/user"

interface ProgramEnrollmentDialogProps {
  program: V2ProgramDetail
  /**
   * Called after a program enrollment is successfully created.
   * By default, redirects to dashboard home.
   */
  onProgramEnroll?: () => void
  /**
   * When true, uses "course" language instead of "program".
   */
  displayAsCourse?: boolean
}

const getCertReasons = (resourceType: string) => [
  "Certificate is signed by MIT faculty",
  "Highlight on your resume/CV",
  `Demonstrates knowledge and skills taught in this ${resourceType}`,
  "Share on your social channels & LinkedIn",
  "Enhance your college & earn a promotion",
  "Enhance your college application with an earned certificate from MIT",
]

const ProgramCertificateUpsell: React.FC<{
  program: V2ProgramDetail
  resourceType: string
}> = ({ program, resourceType }) => {
  const product = program.products[0]
  const financialAidUrl = program.page?.financial_assistance_form_url ?? ""
  const hasFinancialAid = !!(financialAidUrl && product)
  const isAuthenticated = useUserIsAuthenticated()
  const replaceBasketItem = useReplaceBasketItem()
  const userFlexiblePrice = useQuery({
    ...productQueries.userFlexiblePriceDetail({ productId: product?.id ?? 0 }),
    enabled: isAuthenticated && hasFinancialAid,
  })
  const price = product
    ? priceWithDiscount({
        product,
        flexiblePrice: userFlexiblePrice.data,
        avoidCents: true,
      })
    : null

  return (
    <Stack gap="32px" alignItems="flex-start">
      <Typography variant="subtitle1">
        Would you like to get a certificate for this {resourceType}?
      </Typography>
      <CertificateReasonsList>
        {getCertReasons(resourceType).map((reason, index) => (
          <CertificateReasonItem key={index}>
            <RiCheckLine aria-hidden="true" />
            {reason}
          </CertificateReasonItem>
        ))}
      </CertificateReasonsList>
      <CertificateBox disabled={!product}>
        <CertificatePriceRoot>
          <RiAwardFill />
          <Stack gap="4px">
            <strong>
              Get Certificate{" "}
              {price?.isDiscounted ? (
                <span
                  role="group"
                  aria-label={`Discounted price: ${price.finalPrice}, was ${price.originalPrice}`}
                >
                  <span aria-hidden="true">
                    {price.finalPrice}{" "}
                    <StrickenText>{price.originalPrice}</StrickenText>
                  </span>
                </span>
              ) : product ? (
                formatPrice(product.price, { avoidCents: true })
              ) : null}
            </strong>
            {hasFinancialAid && price ? (
              <UnderlinedLink
                color="black"
                href={mitxonlineLegacyUrl(financialAidUrl)}
                target="_blank"
                rel="noopener noreferrer"
              >
                {price.approvedFinancialAid
                  ? "Financial assistance applied"
                  : "Financial assistance available"}
              </UnderlinedLink>
            ) : null}
          </Stack>
        </CertificatePriceRoot>
        <BigButton
          label="Add to Cart"
          sublabel="to get a Certificate"
          endIcon={<RiArrowRightLine aria-hidden="true" />}
          disabled={!product}
          onClick={() => {
            if (!product) return
            replaceBasketItem.mutate(product.id)
          }}
        />
      </CertificateBox>
      {replaceBasketItem.isError && (
        <Alert severity="error">
          There was a problem processing your enrollment. Please try again.
        </Alert>
      )}
    </Stack>
  )
}

const ProgramEnrollmentDialogInner: React.FC<ProgramEnrollmentDialogProps> = ({
  program,
  onProgramEnroll,
  displayAsCourse,
}) => {
  const modal = NiceModal.useModal()
  const createProgramEnrollment = useCreateProgramEnrollment()
  const router = useRouter()
  const showUpsell = getEnrollmentType(program.enrollment_modes) === "both"
  const resourceType = displayAsCourse ? "course" : "program"

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    createProgramEnrollment.mutate(
      { V3ProgramEnrollmentRequestRequest: { program_id: program.id } },
      {
        onSuccess: () => {
          if (onProgramEnroll) {
            onProgramEnroll()
          } else {
            router.push(
              enrollmentAlertSuccessUrl({
                title: program.title ?? "your enrollment",
              }),
            )
          }
          modal.hide()
        },
      },
    )
  }

  return (
    <StyledFormDialog
      {...muiDialogV5(modal)}
      title={program.title}
      onSubmit={handleSubmit}
      fullWidth
      confirmText={
        showUpsell ? "Enroll for Free without a certificate" : "Enroll for Free"
      }
    >
      <Stack
        sx={(theme) => ({
          color: theme.custom.colors.darkGray2,
        })}
        gap="24px"
      >
        {showUpsell && (
          <ProgramCertificateUpsell
            program={program}
            resourceType={resourceType}
          />
        )}
        {createProgramEnrollment.isError && (
          <div ref={(el) => el?.scrollIntoView()}>
            <Alert severity="error">
              There was a problem enrolling you in this {resourceType}. Please
              try again later.
            </Alert>
          </div>
        )}
      </Stack>
    </StyledFormDialog>
  )
}

const ProgramEnrollmentDialog = NiceModal.create(ProgramEnrollmentDialogInner)

export default ProgramEnrollmentDialog
