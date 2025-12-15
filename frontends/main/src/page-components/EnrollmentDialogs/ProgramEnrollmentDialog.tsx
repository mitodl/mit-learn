import React, { useState } from "react"
import { SimpleSelectOption, Stack, Typography } from "ol-components"
import NiceModal, { muiDialogV5 } from "@ebay/nice-modal-react"
import {
  CourseRunV2,
  CourseWithCourseRunsSerializerV2,
  PaginatedCourseWithCourseRunsSerializerV2List,
  V2Program,
} from "@mitodl/mitxonline-api-axios/v2"
import { canUpgrade } from "@/common/mitxonline"
import { useCreateEnrollment } from "api/mitxonline-hooks/enrollment"
import { coursesQueries } from "api/mitxonline-hooks/courses"
import { useQuery } from "@tanstack/react-query"
import { useRouter } from "next-nprogress-bar"
import { DASHBOARD_HOME } from "@/common/urls"
import {
  CertificateUpsell,
  StyledFormDialog,
  StyledSimpleSelectField,
} from "./CourseEnrollmentDialog"

interface ProgramEnrollmentDialogProps {
  program: V2Program
  /**
   * Called after a course enrollment is successfully created
   * By default, redirects to dashboard home.
   */
  onCourseEnroll?: (run: CourseRunV2) => void
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

const ProgramEnrollmentDialogInner: React.FC<ProgramEnrollmentDialogProps> = ({
  program,
  onCourseEnroll,
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
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!run) return
    await createEnrollment.mutateAsync({
      run_id: run.id,
    })
    if (onCourseEnroll) {
      onCourseEnroll(run)
    } else {
      router.push(DASHBOARD_HOME)
    }
  }

  return (
    <StyledFormDialog
      {...muiDialogV5(modal)}
      title={program.title}
      onSubmit={handleSubmit}
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

const ProgramEnrollmentDialog = NiceModal.create(ProgramEnrollmentDialogInner)

export default ProgramEnrollmentDialog
