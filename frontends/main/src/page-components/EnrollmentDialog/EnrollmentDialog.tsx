import React, { useState } from "react"
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
  PaginatedCourseWithCourseRunsSerializerV2List,
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
            <strong>Get Certificate{price ? `: ${price}` : ""}</strong>
            <CertDate disabled={!enabled}>
              {enabled ? deadlineUI : "Not available"}
            </CertDate>
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

const RUN_DEFAULT_OPTION: SimpleSelectOption = {
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
  const options: SimpleSelectOption[] = [RUN_DEFAULT_OPTION, ...runOptions]
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
          CourseRunEnrollmentRequestV2Request: {
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

const COURSES_PAGE_SIZE = 100
const getNextRun = (course?: CourseWithCourseRunsSerializerV2) => {
  return course?.courseruns.find((run) => run.id === course.next_run_id)
}
const getCourseOptions = ({
  data,
  isLoading,
}: {
  data?: PaginatedCourseWithCourseRunsSerializerV2List
  isLoading: boolean
}): SimpleSelectOption[] => {
  const opts: SimpleSelectOption[] =
    data?.results.map((course) => {
      const run = getNextRun(course)
      const upgradeCaveat =
        run && !canUpgrade(run) ? " (No certificate available)" : ""
      const label = run
        ? `${course.title} - ${run.course_number}${upgradeCaveat}`
        : `${course.title} - (No available runs)`
      return {
        label: label,
        value: `${course.id}`,
      }
    }) ?? []
  if (isLoading) {
    return [
      {
        label: "Loading courses...",
        value: "-",
        disabled: true,
      },
    ]
  }
  return opts
}
const COURSE_DEFAULT_OPTION: SimpleSelectOption = {
  label: "Please Select",
  value: "",
  disabled: true,
}

const ProgramEnrollmentDialog: React.FC<ProgramEnrollmentDialogProps> = ({
  program,
}) => {
  const modal = NiceModal.useModal()
  const courses = useQuery(
    coursesQueries.coursesList({
      id: program.courses,
      page_size: COURSES_PAGE_SIZE, // in practice, these are like 3-5 courses
    }),
  )
  const createEnrollment = useCreateEnrollment()
  const [chosenCourseId, setChosenCourseId] = useState("")
  const options = [COURSE_DEFAULT_OPTION, ...getCourseOptions(courses)]
  const chosenCourse = courses.data?.results.find(
    (course) => `${course.id}` === chosenCourseId,
  )
  const run = getNextRun(chosenCourse)

  return (
    <StyledFormDialog
      {...muiDialogV5(modal)}
      title={program.title}
      onSubmit={async (e) => {
        e.preventDefault()
        if (!run) return
        await createEnrollment.mutateAsync({
          CourseRunEnrollmentRequestV2Request: {
            run_id: run.id,
          },
        })
      }}
      onReset={() => setChosenCourseId("")}
      fullWidth
      confirmText="No thanks, I'll take the course for free without a certificate"
      disabled={!run}
    >
      <Stack
        sx={(theme) => ({
          color: theme.custom.colors.darkGray2,
        })}
        gap="24px"
      >
        <Typography variant="body2">
          Thank you for choosing an MITx online program. To complete your
          enrollment in this program, you must choose a course to start with.
          You can enroll now for free, but you will need to pay for a
          certificate in order to earn the program credential.
        </Typography>
        <StyledSimpleSelectField
          label="Choose a date:"
          options={options}
          value={chosenCourseId}
          onChange={(e) => setChosenCourseId(e.target.value)}
          error={courses.isError}
          errorText={courses.isError ? "Error loading courses" : undefined}
        />
        <CertificateUpsell courseRun={run} />
      </Stack>
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
      resource: V2Program
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
