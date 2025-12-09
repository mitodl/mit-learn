import React from "react"
import {
  FormDialog,
  SimpleSelectOption,
  SimpleSelectField,
  styled,
  Stack,
  Typography,
  PlainList,
} from "ol-components"
import NiceModal, { muiDialogV5 } from "@ebay/nice-modal-react"
import {
  CourseRunV2,
  CourseWithCourseRunsSerializerV2,
  V2Program,
} from "@mitodl/mitxonline-api-axios/v2"
import { formatDate, LocalDate } from "ol-utilities"
import { RiCheckLine, RiArrowRightLine, RiAwardFill } from "@remixicon/react"
import { Button, ButtonProps } from "@mitodl/smoot-design"
import {
  canUpgrade,
  getCertificatePrice,
  upgradeRunUrl,
} from "@/common/mitxonline"
import { useCreateEnrollment } from "api/mitxonline-hooks/enrollment"
import { coursesQueries } from "api/mitxonline-hooks/courses"
import { useQuery } from "@tanstack/react-query"

const StyledSimpleSelectField = styled(SimpleSelectField)(({ theme }) => ({
  "&&& label": {
    ...theme.typography.subtitle1,
    marginBottom: "8px",
  },
})) as typeof SimpleSelectField

const StyledFormDialog = styled(FormDialog)({
  ".MuiPaper-root": {
    maxWidth: "702px",
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
          <Typography
            component="span"
            variant="h5"
            sx={(theme) => ({ fontWeight: theme.typography.fontWeightBold })}
          >
            {label}
          </Typography>
          <br />
          <Typography component="span" variant="h5">
            {sublabel}
          </Typography>
        </span>
        {endIcon}
      </Button>
    )
  },
)({
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
})

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
    },
    disabled && {
      background: "rgba(3, 21, 45, 0.025)",
      color: theme.custom.colors.silverGrayDark,
    },
  ],
)
const CertificatePriceRoot = styled.div({
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "flex-start",
  gap: "12px",
  svg: {
    width: "40px",
    height: "40px",
  },
})

const CertificateReasonsList = styled(PlainList)({
  display: "grid",
  rowGap: "24px",
  columnGap: "40px",
  gridTemplateColumns: "1fr 1fr",
})
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
const CertificateUpsell: React.FC<{
  courseRun?: CourseRunV2
}> = ({ courseRun }) => {
  const enabled = courseRun ? canUpgrade(courseRun) : false
  const product = courseRun?.products[0]
  const price = courseRun && enabled ? getCertificatePrice(courseRun) : null
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
      <CertificateBox disabled={!enabled}>
        <CertificatePriceRoot>
          <RiAwardFill />
          <Stack gap="4px">
            <Typography
              component="span"
              variant="h5"
              sx={(theme) => ({
                fontWeight: theme.typography.fontWeightBold,
                marginBottom: "4px",
              })}
            >
              Get Certificate{price ? `: ${price}` : ""}
            </Typography>
            <Typography component="span" variant="body1">
              {enabled ? deadlineUI : "Not available"}
            </Typography>
          </Stack>
        </CertificatePriceRoot>
        <BigButton
          label="Add to Cart"
          sublabel="to get a Certificate"
          endIcon={<RiArrowRightLine aria-hidden="true" />}
          disabled={!enabled}
          onClick={() => {
            if (!product) return
            const url = upgradeRunUrl(product)
            window.location.assign(url)
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
        label: canUpgrade(run) ? dates : `${dates} (No certificate available)`,
        value: `${run.id}`,
      }
    })
}

const DEFAULT_OPTION: SimpleSelectOption = {
  label: "Please Select",
  value: "",
  disabled: true,
}

type CourseEnrollmentDialogProps = {
  course: CourseWithCourseRunsSerializerV2
}

const CourseEnrollmentDialog: React.FC<CourseEnrollmentDialogProps> = ({
  course,
}) => {
  const modal = NiceModal.useModal()
  const runOptions = getRunOptions(course)
  const options: SimpleSelectOption[] = [DEFAULT_OPTION, ...runOptions]
  const getDefaultOption = () => {
    // if multiple options, force a choice
    return runOptions.length === 1 ? runOptions[0].value : ""
  }
  const [chosenRun, setChosenRun] = React.useState<string>(getDefaultOption)
  const run = course.courseruns.find((r) => `${r.id}` === chosenRun)
  const createEnrollment = useCreateEnrollment()
  return (
    <StyledFormDialog
      {...muiDialogV5(modal)}
      title={course.title ?? ""}
      fullWidth
      confirmText="Enroll for Free without a certificate"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!run) return
        await createEnrollment.mutateAsync({
          CourseRunEnrollmentRequest: {
            run_id: run.id,
          },
        })
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
        <CertificateUpsell courseRun={run} />
      </Stack>
    </StyledFormDialog>
  )
}

type ProgramEnrollmentDialogProps = {
  program: V2Program
}
const ProgramEnrollmentDialog: React.FC<ProgramEnrollmentDialogProps> = ({
  program,
}) => {
  const modal = NiceModal.useModal()
  const courses = useQuery(coursesQueries.coursesList({ id: program.courses }))
  console.log({ courses })
  return (
    <StyledFormDialog
      {...muiDialogV5(modal)}
      title={"Program Enrollment"}
      onSubmit={console.log}
      onReset={console.log}
      fullWidth
    >
      Placeholder
    </StyledFormDialog>
  )
}

type EnrollmentDialogProps =
  | {
      resource: CourseWithCourseRunsSerializerV2
      type: "course"
    }
  | {
      type: "program"
      resource?: V2Program
    }
const EnrollmentDialogInner: React.FC<EnrollmentDialogProps> = ({
  type,
  resource,
}) => {
  return type === "course" ? (
    <CourseEnrollmentDialog course={resource} />
  ) : (
    <ProgramEnrollmentDialog program={resource} />
  )
}

const EnrollmentDialog = NiceModal.create(EnrollmentDialogInner)

export default EnrollmentDialog
