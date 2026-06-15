/**
 * CoursewareCard — unified dashboard course card.
 *
 * A thin router that dispatches on `kind` (the resource identity) to one of
 * three isolated cards. `layout` carries presentation density only and is
 * always orthogonal to `kind`:
 *   - "course"             → a course row from a program/contract dashboard;
 *                            the entry's `displayedEnrollment` decides whether
 *                            it renders as enrolled or unenrolled.
 *   - "enrollment"         → a single course-run enrollment (home "My Learning"
 *                            rows, which cannot build a full entry).
 *   - "program-enrollment" → a program enrollment.
 */
import React from "react"
import { type DashboardCourseEntry } from "./model/dashboardViewModel"
import type {
  CourseRunEnrollmentV3,
  V3UserProgramEnrollment,
} from "@mitodl/mitxonline-api-axios/v2"
import { ProgramEnrollmentCard } from "./ProgramEnrollmentCard"
import { EnrolledCourseCard } from "./EnrolledCourseCard"
import { UnenrolledCourseCard } from "./UnenrolledCourseCard"

// ---------------------------------------------------------------------------
// Prop types
// ---------------------------------------------------------------------------

type StyledComponentBaseProps = {
  className?: string
  Component?: React.ElementType
}

/**
 * Presentation props shared by the two course-display arms. The program arm
 * has no density/heading/upgrade concerns, so it does not include these.
 */
type CourseDisplayProps = {
  /** Visual density only. Identity is carried by `kind`, never by `layout`. */
  layout?: "default" | "compact"
  headingLevel?: "h2" | "h3" | "h4" | "h5" | "h6"
  onUpgradeError?: (error: string) => void
}

/** A course row from a program/contract dashboard (full entry available). */
type CoursewareCardCourseProps = StyledComponentBaseProps &
  CourseDisplayProps & {
    kind: "course"
    entry: DashboardCourseEntry
  }

/**
 * A single course-run enrollment — home "My Learning" rows. Home cannot build
 * an honest `DashboardCourseEntry` (its V3 payload embeds only a thin course,
 * not the full course-with-courseruns), so the enrollment is passed directly.
 */
type CoursewareCardEnrollmentProps = StyledComponentBaseProps &
  CourseDisplayProps & {
    kind: "enrollment"
    enrollment: CourseRunEnrollmentV3
  }

/** A program enrollment. */
type CoursewareCardProgramEnrollmentProps = StyledComponentBaseProps & {
  kind: "program-enrollment"
  programEnrollment: V3UserProgramEnrollment
}

export type CoursewareCardProps =
  | CoursewareCardCourseProps
  | CoursewareCardEnrollmentProps
  | CoursewareCardProgramEnrollmentProps

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const CoursewareCard: React.FC<CoursewareCardProps> = (props) => {
  const { Component, className } = props

  if (props.kind === "program-enrollment") {
    return (
      <ProgramEnrollmentCard
        programEnrollment={props.programEnrollment}
        Component={Component}
        className={className}
      />
    )
  }

  const { layout, headingLevel, onUpgradeError } = props

  if (props.kind === "enrollment") {
    return (
      <EnrolledCourseCard
        enrollment={props.enrollment}
        layout={layout}
        headingLevel={headingLevel}
        onUpgradeError={onUpgradeError}
        Component={Component}
        className={className}
      />
    )
  }

  const { entry } = props
  return entry.displayedEnrollment ? (
    // Happens to be the same as the enrollment branch above, for now.
    // Will likely diverge with multiple enrollment display.
    <EnrolledCourseCard
      enrollment={entry.displayedEnrollment}
      layout={layout}
      headingLevel={headingLevel}
      onUpgradeError={onUpgradeError}
      Component={Component}
      className={className}
    />
  ) : (
    <UnenrolledCourseCard
      course={entry.course}
      displayedRun={entry.displayedRun ?? undefined}
      contractId={entry.contractId}
      ancestorContext={entry.ancestorContext}
      layout={layout}
      headingLevel={headingLevel}
      Component={Component}
      className={className}
    />
  )
}

export { CoursewareCard }
