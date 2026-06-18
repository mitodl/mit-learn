import React from "react"
import {
  BaseCourseRun,
  CourseWithCourseRunsSerializerV2,
  V3UserProgramEnrollment,
} from "@mitodl/mitxonline-api-axios/v2"
import { LoadingSpinner, Stack } from "ol-components"
import {
  CardRoot,
  CardTypeText,
  CourseStartCountdown,
  CoursewareActionColumn,
  CoursewareButton,
  EndDateText,
  TitleText,
} from "./CardShared"
import { EnrollmentStatus, getBestRun } from "./helpers"
import { isVerifiedEnrollmentMode } from "@/common/mitxonline"
import { useEnrollmentHandler } from "./hooks/useEnrollmentHandler"
import { EnrollmentStatusIndicator } from "./EnrollmentStatusIndicator"
import { Button } from "@mitodl/smoot-design"
import { calendarDaysUntil, isInPast } from "ol-utilities"

type UnenrolledCourseCardProps = {
  course: CourseWithCourseRunsSerializerV2
  displayedRun?: BaseCourseRun
  contractId?: number
  ancestorContext?: {
    programEnrollment?: V3UserProgramEnrollment
    parentProgramReadableIds?: string[]
    useVerifiedEnrollment?: boolean
  }
  layout?: "default" | "compact"
  headingLevel?: "h2" | "h3" | "h4" | "h5" | "h6"
  Component?: React.ElementType
  className?: string
}

export const UnenrolledCourseCard = ({
  course,
  displayedRun: displayedRunProp,
  contractId,
  ancestorContext,
  layout = "default",
  headingLevel,
  Component,
  className,
}: UnenrolledCourseCardProps) => {
  const enrollment = useEnrollmentHandler()
  const isPending = enrollment.isPending
  const courseRun =
    displayedRunProp ?? getBestRun(course, { enrollableOnly: true, contractId })
  const coursewareUrl = courseRun?.courseware_url || undefined
  const readableId = courseRun?.courseware_id
  const isDisabled = !courseRun?.is_enrollable || !coursewareUrl || !readableId
  const title =
    layout === "compact" ? course.title : courseRun?.title || course.title
  const endDate = courseRun?.end_date
  const daysUntilEnd = endDate ? calendarDaysUntil(endDate) : null
  const hasEnded = endDate ? isInPast(endDate) : false
  const isContractPageResource = Boolean(contractId)
  const handleEnrollmentClick = React.useCallback(() => {
    const isVerifiedProgramEnrollment =
      Boolean(ancestorContext?.useVerifiedEnrollment) ||
      isVerifiedEnrollmentMode(
        ancestorContext?.programEnrollment?.enrollment_mode,
      )

    enrollment.enroll({
      course: course,
      readableId: readableId,
      href: coursewareUrl ?? undefined,
      selectedCoursewareUrl: coursewareUrl ?? undefined,
      isB2B: isContractPageResource,
      isVerifiedProgram: isVerifiedProgramEnrollment,
      programCoursewareId:
        ancestorContext?.programEnrollment?.program.readable_id,
      programReadableIds: ancestorContext?.parentProgramReadableIds,
      b2bProgramId:
        ancestorContext?.parentProgramReadableIds?.[0] ??
        ancestorContext?.programEnrollment?.program.readable_id,
    })
  }, [
    course,
    ancestorContext,
    readableId,
    coursewareUrl,
    isContractPageResource,
    enrollment,
  ])
  const enrollClick: React.MouseEventHandler | undefined = (e) => {
    e.preventDefault()
    handleEnrollmentClick()
  }
  const isCompact = layout === "compact"
  const titleSection = (
    <TitleText
      as={headingLevel}
      clickable={!isDisabled}
      onClick={isDisabled ? undefined : enrollClick}
    >
      {title}
    </TitleText>
  )
  const daysAgo = Math.abs(daysUntilEnd ?? 0)
  const endDateSection = endDate ? (
    <EndDateText>
      {hasEnded
        ? `Ended ${daysAgo} ${daysAgo === 1 ? "day" : "days"} ago`
        : `Ends in ${daysUntilEnd} ${daysUntilEnd === 1 ? "day" : "days"}`}
    </EndDateText>
  ) : null
  const startButton = isCompact ? (
    <CoursewareButton
      size="small"
      variant="secondary"
      data-testid="courseware-button"
      onClick={isDisabled ? undefined : enrollClick}
      disabled={isDisabled}
      endIcon={
        isPending ? (
          <LoadingSpinner color="inherit" loading={isPending} size={16} />
        ) : null
      }
    >
      Start
    </CoursewareButton>
  ) : (
    <Button
      size="small"
      variant="primary"
      data-testid="courseware-button"
      onClick={isDisabled ? undefined : enrollClick}
      disabled={isDisabled}
      endIcon={
        isPending ? (
          <LoadingSpinner color="inherit" loading={isPending} size={16} />
        ) : null
      }
    >
      Start
    </Button>
  )
  const buttonSection = isCompact ? (
    <Stack direction="column" gap="4px" alignItems="stretch">
      <Stack direction="row" gap="8px" alignItems="center">
        {endDateSection}
        <CoursewareActionColumn direction="row" justifyContent="center">
          {startButton}
        </CoursewareActionColumn>
      </Stack>
      {courseRun?.start_date ? (
        <CoursewareActionColumn
          direction="row"
          justifyContent="center"
          alignSelf="flex-end"
        >
          <CourseStartCountdown
            startDate={courseRun?.start_date as string}
            layout={layout}
          />
        </CoursewareActionColumn>
      ) : null}
    </Stack>
  ) : (
    <>
      <EnrollmentStatusIndicator
        status={EnrollmentStatus.NotEnrolled}
        showNotComplete={Boolean(isContractPageResource)}
      />
      {startButton}
    </>
  )
  const startDateSection =
    !isCompact && courseRun?.start_date ? (
      <CourseStartCountdown
        startDate={courseRun?.start_date as string}
        layout={layout}
      />
    ) : null

  return (
    <>
      <CardRoot
        screenSize="desktop"
        data-testid="enrollment-card-desktop"
        as={Component}
        className={className}
        layout={layout}
      >
        <Stack justifyContent="start" alignItems="stretch" gap="6px" flex={1}>
          <CardTypeText>Course</CardTypeText>
          {titleSection}
          {!isCompact && endDateSection}
        </Stack>
        <Stack gap="8px">
          <Stack
            direction="row"
            gap="8px"
            paddingRight="32px"
            alignItems="center"
          >
            {buttonSection}
          </Stack>
          {startDateSection}
        </Stack>
      </CardRoot>

      <CardRoot
        screenSize="mobile"
        data-testid="enrollment-card-mobile"
        as={Component}
        className={className}
        layout={layout}
      >
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="stretch"
          flex={1}
          width="100%"
        >
          <Stack direction="column" gap="8px" flex={1}>
            {titleSection}
            {!isCompact && endDateSection}
          </Stack>
        </Stack>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="end"
          width="100%"
        >
          {startDateSection}
          <Stack direction="row" gap="8px" alignItems="center">
            {buttonSection}
          </Stack>
        </Stack>
      </CardRoot>
    </>
  )
}
