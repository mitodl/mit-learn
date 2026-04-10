import React from "react"
import { Stack, Typography } from "ol-components"
import NiceModal, { muiDialogV5 } from "@ebay/nice-modal-react"
import { V2ProgramDetail } from "@mitodl/mitxonline-api-axios/v2"
import { useCreateProgramEnrollment } from "api/mitxonline-hooks/enrollment"
import { useReplaceBasketItem } from "api/mitxonline-hooks/baskets"
import { useRouter } from "next-nprogress-bar"
import {
  dashboardEnrollmentSuccessUrl,
  formatPrice,
  getEnrollmentType,
} from "@/common/mitxonline"
import {
  BigButton,
  CertificateBox,
  CertificatePriceRoot,
  CertificateReasonItem,
  CertificateReasonsList,
  StyledFormDialog,
} from "./CourseEnrollmentDialog"
import { RiArrowRightLine, RiAwardFill, RiCheckLine } from "@remixicon/react"
import { Alert } from "@mitodl/smoot-design"

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
  const replaceBasketItem = useReplaceBasketItem()

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
              Get Certificate {product ? formatPrice(product.price) : null}
            </strong>
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
              dashboardEnrollmentSuccessUrl({
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
