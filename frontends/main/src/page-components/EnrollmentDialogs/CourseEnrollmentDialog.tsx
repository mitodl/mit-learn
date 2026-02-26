import React from "react"
import {
  FormDialog,
  SimpleSelectOption,
  SimpleSelectField,
  styled,
  Stack,
  Typography,
  PlainList,
  Link,
} from "ol-components"
import NiceModal, { muiDialogV5 } from "@ebay/nice-modal-react"
import {
  CourseRunV2,
  CourseWithCourseRunsSerializerV2,
} from "@mitodl/mitxonline-api-axios/v2"
import { formatDate, LocalDate } from "ol-utilities"
import { RiCheckLine, RiArrowRightLine, RiAwardFill } from "@remixicon/react"
import { Alert, Button, ButtonProps } from "@mitodl/smoot-design"
import {
  canUpgradeRun,
  mitxonlineUrl,
  PriceWithDiscount,
  priceWithDiscount,
} from "@/common/mitxonline"
import { useCreateEnrollment } from "api/mitxonline-hooks/enrollment"
import { useAddToBasket, useClearBasket } from "api/mitxonline-hooks/baskets"
import { useRouter } from "next-nprogress-bar"
import { DASHBOARD_HOME } from "@/common/urls"
import { useQuery } from "@tanstack/react-query"
import { productQueries } from "api/mitxonline-hooks/products"

interface CourseEnrollmentDialogProps {
  course: CourseWithCourseRunsSerializerV2
  /**
   * Called after a course enrollment is successfully created
   * By default, redirects to dashboard home.
   */
  onCourseEnroll?: (run: CourseRunV2) => void
}

const StyledSimpleSelectField = styled(SimpleSelectField)(({ theme }) => ({
  "&&& label": {
    ...theme.typography.subtitle1,
    marginBottom: "8px",
  },
})) as typeof SimpleSelectField

const UnderlinedLink = styled(Link)({
  textDecoration: "underline",
})

const StyledFormDialog = styled(FormDialog)({
  ".MuiPaper-root": {
    maxWidth: "750px",
  },
})

type BigButtonProps = {
  label: string
  sublabel: string
  endIcon: React.ReactNode
} & Omit<ButtonProps, "children" | "endIcon" | "startIcon" | "variant" | "size">
const BigButton = styled(
  ({ label, sublabel, endIcon, ...others }: BigButtonProps) => {
    return (
      <Button variant="primary" {...others}>
        <span>
          <span className="label">{label}</span>
          <br />
          <span className="sublabel">{sublabel}</span>
        </span>
        {endIcon}
      </Button>
    )
  },
)(({ theme }) => ({
  // mostly inheriting colors, hover, etc from regular button.
  padding: "16px 32px",
  boxShadow: "none",
  display: "inline-flex",
  alignItems: "center",
  gap: "32px",
  textAlign: "left",
  justifyContent: "flex-start",
  svg: {
    width: "24px",
    height: "24px",
  },
  ...theme.typography.h5,
  [theme.breakpoints.down("sm")]: {
    ...theme.typography.subtitle2,
    padding: "12px 20px",
    gap: "16px",
    justifyContent: "space-between",
  },
  ".label": {
    fontWeight: theme.typography.fontWeightBold,
  },
}))

const CertificateBox = styled.div<{ disabled?: boolean }>(
  ({ theme, disabled }) => [
    {
      padding: "16px",
      display: "flex",
      width: "100%",
      justifyContent: "space-between",
      alignItems: "center",
      background: "rgba(3, 21, 45, 0.05)",
      borderRadius: "4px",
      border: "1px solid  #DFE5EC",
      gap: "24px",
      [theme.breakpoints.down("sm")]: {
        flexDirection: "column",
        alignItems: "stretch",
        gap: "12px",
      },
    },
    disabled && {
      background: "rgba(3, 21, 45, 0.025)",
      color: theme.custom.colors.silverGrayDark,
    },
  ],
)
const CertDate = styled.span<{ disabled?: boolean }>(({ theme, disabled }) => [
  { ...theme.typography.body1 },
  !disabled && { color: theme.custom.colors.red },
])

const CertificatePriceRoot = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "flex-start",
  gap: "12px",
  svg: {
    width: "40px",
    height: "40px",
  },
  ...theme.typography.h5,
  [theme.breakpoints.down("sm")]: {
    svg: {
      width: "32px",
      height: "32px",
    },
    ...theme.typography.subtitle1,
  },
}))

const CertificateReasonsList = styled(PlainList)(({ theme }) => ({
  display: "grid",
  rowGap: "24px",
  columnGap: "40px",
  gridTemplateColumns: "1fr 1fr",
  [theme.breakpoints.down("sm")]: {
    gridTemplateColumns: "1fr",
  },
}))
const CertificateReasonItem = styled.li(({ theme }) => ({
  display: "flex",
  alignItems: "flex-start",
  gap: "8px",
  ...theme.typography.body2,
  svg: {
    width: "20px",
    height: "20px",
    color: theme.custom.colors.green,
  },
  "> *": { flexShrink: 0 },
}))
const CERT_REASONS = [
  "Certificate is signed by MIT faculty",
  "Highlight on your resume/CV",
  "Demonstrates knowledge and skills taught in this course",
  "Share on your social channels & LinkedIn",
  "Enhance your college & earn a promotion",
  "Enhance your college application with an earned certificate from MIT",
]

const StrickenText = styled.span(({ theme }) => ({
  textDecoration: "line-through",
  color: theme.custom.colors.silverGrayDark,
  ...theme.typography.body2,
}))
const NumericPriceDisplay: React.FC<{
  price: PriceWithDiscount | null
}> = ({ price }) => {
  if (!price) return null
  if (!price.isDiscounted) return price.finalPrice
  return (
    <span>
      {price.finalPrice} <StrickenText>{price.originalPrice}</StrickenText>
    </span>
  )
}

const CertificateUpsell: React.FC<{
  course?: CourseWithCourseRunsSerializerV2
  courseRun?: CourseRunV2
}> = ({ course, courseRun }) => {
  const product = courseRun?.products[0]
  const canUpgrade = !!(product && courseRun && canUpgradeRun(courseRun))
  const addToBasket = useAddToBasket()
  const clearBasket = useClearBasket()
  const userFlexiblePrice = useQuery({
    ...productQueries.userFlexiblePriceDetail({
      productId: product?.id ?? 0,
    }),
    enabled: canUpgrade && !!course?.page.financial_assistance_form_url,
  })
  const price = canUpgrade
    ? priceWithDiscount({ product, flexiblePrice: userFlexiblePrice.data })
    : null
  const hasFinancialAssistance = !!course?.page.financial_assistance_form_url
  const deadlineUI = courseRun?.upgrade_deadline ? (
    <>
      Payment due: <LocalDate date={courseRun.upgrade_deadline} />
    </>
  ) : null
  return (
    <Stack gap="32px" alignItems="flex-start">
      <Typography variant="subtitle1">
        Would you like to get a certificate for this course?
      </Typography>
      <CertificateReasonsList>
        {CERT_REASONS.map((reason, index) => (
          // reasons are static, index key is OK
          <CertificateReasonItem key={index}>
            <RiCheckLine aria-hidden="true" />
            {reason}
          </CertificateReasonItem>
        ))}
      </CertificateReasonsList>
      <CertificateBox disabled={!canUpgrade}>
        <CertificatePriceRoot>
          <RiAwardFill />
          <Stack gap="4px">
            <strong>
              Get Certificate <NumericPriceDisplay price={price} />
            </strong>
            {hasFinancialAssistance && price ? (
              <UnderlinedLink
                color="black"
                href={mitxonlineUrl(course.page.financial_assistance_form_url)}
                target="_blank"
                rel="noopener noreferrer"
              >
                {price.approvedFinancialAid
                  ? "Financial assistance applied"
                  : "Financial assistance available"}
              </UnderlinedLink>
            ) : null}
            <CertDate disabled={!canUpgrade}>
              {canUpgrade ? deadlineUI : "Not available"}
            </CertDate>
          </Stack>
        </CertificatePriceRoot>
        <BigButton
          label="Add to Cart"
          sublabel="to get a Certificate"
          endIcon={<RiArrowRightLine aria-hidden="true" />}
          disabled={!canUpgrade}
          onClick={async () => {
            if (!product) return
            addToBasket.reset()
            clearBasket.reset()
            await clearBasket.mutateAsync()
            await addToBasket.mutateAsync(product.id)
          }}
        />
      </CertificateBox>
    </Stack>
  )
}

const getRunOptions = (
  course: CourseWithCourseRunsSerializerV2,
): SimpleSelectOption[] => {
  return course.courseruns
    .filter((run) => run.is_enrollable)
    .map((run) => {
      const dates = [run.start_date, run.end_date]
        .filter((d) => typeof d === "string")
        .map((d) => formatDate(d))
        .join(" - ")
      return {
        label: canUpgradeRun(run)
          ? dates
          : `${dates} (No certificate available)`,
        value: `${run.id}`,
      }
    })
}

const RUN_DEFAULT_OPTION: SimpleSelectOption = {
  label: "Please Select",
  value: "",
  disabled: true,
}

const CourseEnrollmentDialogInner: React.FC<CourseEnrollmentDialogProps> = ({
  course,
  onCourseEnroll,
}) => {
  const modal = NiceModal.useModal()
  const runOptions = getRunOptions(course)
  const options: SimpleSelectOption[] = [RUN_DEFAULT_OPTION, ...runOptions]
  const getDefaultOption = () => {
    // if multiple options, force a choice
    return runOptions.length === 1 ? runOptions[0].value : ""
  }
  const [chosenRun, setChosenRun] = React.useState<string>(getDefaultOption)
  const run = course.courseruns.find((r) => `${r.id}` === chosenRun)
  const createEnrollment = useCreateEnrollment()
  const router = useRouter()
  return (
    <StyledFormDialog
      {...muiDialogV5(modal)}
      title={course.title ?? ""}
      fullWidth
      confirmText="Enroll for Free without a certificate"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!run) return
        createEnrollment.mutate(
          {
            run_id: run.id,
          },
          {
            onSuccess: () => {
              if (onCourseEnroll) {
                onCourseEnroll(run)
              } else {
                router.push(DASHBOARD_HOME)
              }
              modal.hide()
            },
          },
        )
      }}
      onReset={() => setChosenRun(getDefaultOption())}
      maxWidth={false}
      disabled={!run}
    >
      <Stack
        sx={(theme) => ({
          color: theme.custom.colors.darkGray2,
        })}
        gap="24px"
      >
        <StyledSimpleSelectField
          label="Choose a date:"
          options={options}
          value={chosenRun}
          onChange={(e) => setChosenRun(e.target.value)}
          fullWidth
        />
        <CertificateUpsell course={course} courseRun={run} />
        {createEnrollment.isError && (
          <div ref={(el) => el?.scrollIntoView()}>
            <Alert severity="error">
              There was a problem enrolling you in this course. Please try again
              later.
            </Alert>
          </div>
        )}
      </Stack>
    </StyledFormDialog>
  )
}

const CourseEnrollmentDialog = NiceModal.create(CourseEnrollmentDialogInner)

export default CourseEnrollmentDialog

export { StyledSimpleSelectField, StyledFormDialog, CertificateUpsell }
