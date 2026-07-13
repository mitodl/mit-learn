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
  CoursewareButton,
  TitleText,
  CourseDateSummary,
  Separator,
} from "./CardShared"
import { EnrollmentStatus, getBestRun } from "./helpers"
import { isVerifiedEnrollmentMode } from "@/common/mitxonline"
import { useEnrollmentHandler } from "./hooks/useEnrollmentHandler"
import { EnrollmentStatusIcon } from "./EnrollmentStatus"
import { ProgressBadge } from "./ProgressBadge"
import { Button } from "@mitodl/smoot-design"

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
  isModule?: boolean
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
  isModule,
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
  const isContractPageResource = Boolean(contractId)
  const cardTypeLabelText =
    isModule || isContractPageResource ? "Module" : "Course"
  const cardTypeLabel =
    isModule && layout === "compact" ? null : (
      <CardTypeText>{cardTypeLabelText}</CardTypeText>
    )
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
  const courseDateText = (
    <Stack direction="row" gap="8px" alignItems="start">
      <CourseDateSummary
        startDate={courseRun?.start_date}
        endDate={courseRun?.end_date}
      />
    </Stack>
  )
  const startButton = isCompact ? (
    <CoursewareButton
      size="small"
      variant="secondary"
      data-testid="courseware-button"
      aria-label={`Start course: ${title}`}
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
      aria-label={`Start course: ${title}`}
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
  const buttonSection = (
    <Stack
      direction="row"
      marginRight="8px"
      alignItems="center"
      justifyContent="end"
    >
      {startButton}
    </Stack>
  )

  const progressBadgeSection =
    isModule && isCompact ? null : (
      <Stack direction="row" gap="4px" alignItems="center">
        <ProgressBadge enrollmentStatus={EnrollmentStatus.NotEnrolled} />
        <Separator />
        {cardTypeLabel}
      </Stack>
    )

  const showEnrollmentStatusIcon =
    !isContractPageResource && isModule && isCompact

  return (
    <>
      <CardRoot
        screenSize="desktop"
        data-testid="enrollment-card-desktop"
        as={Component}
        className={className}
        layout={layout}
      >
        {showEnrollmentStatusIcon && (
          <Stack alignSelf="start">
            <EnrollmentStatusIcon status={EnrollmentStatus.NotEnrolled} />
          </Stack>
        )}
        <Stack justifyContent="start" alignItems="stretch" gap="4px" flex={1}>
          {progressBadgeSection}
          <Stack gap="6px">
            {titleSection}
            {courseDateText}
          </Stack>
        </Stack>
        <Stack
          direction="row"
          gap="8px"
          paddingRight="32px"
          alignItems="center"
          justifyContent="end"
        >
          {buttonSection}
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
            {!isCompact && courseDateText}
          </Stack>
        </Stack>
        <Stack
          direction="row"
          width="100%"
          gap="8px"
          alignItems="center"
          justifyContent="end"
        >
          {buttonSection}
        </Stack>
      </CardRoot>
    </>
  )
}
