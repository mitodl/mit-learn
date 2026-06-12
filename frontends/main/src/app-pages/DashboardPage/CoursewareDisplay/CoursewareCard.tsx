/**
 * CoursewareCard — unified dashboard course card (Phase 7).
 *
 * Replaces the `DashboardCard`+adapter pattern for consumers that hold a
 * `DashboardCourseEntry` (program dashboard, contract content).  For the
 * `moduleRow` variant it also replaces the `ModuleCard` usage in
 * `ProgramAsCourseCard`.
 *
 * Internal delegation: this component remains a thin facade over the legacy
 * `DashboardCard` / `ModuleCard` implementations during Phase 7a–7c.  The
 * legacy card rendering logic is moved here in Phase 7d when those files are
 * deleted.
 */
import React from "react"
import type { SimpleMenuItem } from "ol-components"
import { type DashboardCourseEntry } from "./model/dashboardViewModel"
import type { V3UserProgramEnrollment } from "@mitodl/mitxonline-api-axios/v2"
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

/** Props for the default course / enrollment card display. */
type CoursewareCardDefaultProps = StyledComponentBaseProps & {
  layout?: "default" | "compact"
  entry: {
    displayedEnrollment: DashboardCourseEntry["displayedEnrollment"]
  } & Partial<DashboardCourseEntry>
  showNotComplete?: boolean
  offerUpgrade?: boolean
  isLoading?: boolean
  onUpgradeError?: (error: string) => void
  contextMenuItems?: SimpleMenuItem[]
  noun?: string
}

/**
 * Props for the `moduleRow` variant — a compact stacked card used as a row
 * inside a `ProgramAsCourseCard` module list.
 *
 * `useVerifiedEnrollment` and `parentProgramIds` are read from
 * `entry.ancestorContext` so callers only need to embed them there (via
 * `buildCourseEntry`).
 */
type CoursewareCardModuleRowProps = StyledComponentBaseProps & {
  layout: "moduleRow"
  entry: DashboardCourseEntry
  headingLevel?: "h2" | "h3" | "h4" | "h5" | "h6"
  onUpgradeError?: (error: string) => void
}

/** Props for program card display. */
type CoursewareCardProgramProps = StyledComponentBaseProps & {
  layout: "program"
  programEnrollment: V3UserProgramEnrollment
  showNotComplete?: boolean
}

export type CoursewareCardProps =
  | CoursewareCardDefaultProps
  | CoursewareCardModuleRowProps
  | CoursewareCardProgramProps
// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const CoursewareCard: React.FC<CoursewareCardProps> = (props) => {
  // ── program arm ──────────────────────────────────────────────────────────
  if (props.layout === "program") {
    const { programEnrollment, Component, className } = props
    return (
      <ProgramEnrollmentCard
        programEnrollment={programEnrollment}
        Component={Component}
        className={className}
      />
    )
  }

  const { entry, Component, className } = props
  // ── moduleRow arm ────────────────────────────────────────────────────────
  if (props.layout === "moduleRow") {
    const { headingLevel } = props

    const resource = entry.displayedEnrollment
      ? {
          type: "courserun-enrollment" as const,
          data: entry.displayedEnrollment,
        }
      : entry.course
        ? { type: "course" as const, data: entry.course }
        : null

    if (!resource) return null

    if (resource.type === "course") {
      return (
        <UnenrolledCourseCard
          course={resource.data}
          displayedRun={entry.displayedRun ?? undefined}
          contractId={entry.contractId}
          ancestorContext={entry.ancestorContext}
          layout="compact"
          headingLevel={headingLevel}
          Component={Component}
          className={className}
        />
      )
    } else if (resource.type === "courserun-enrollment") {
      return (
        <EnrolledCourseCard
          enrollment={resource.data}
          layout="compact"
          headingLevel={headingLevel}
          onUpgradeError={props.onUpgradeError}
          Component={Component}
          className={className}
        />
      )
    }
    return null
  }

  // ── default / stacked arm ────────────────────────────────────────────────
  const { onUpgradeError, layout } = props

  if (entry.displayedEnrollment) {
    return (
      <EnrolledCourseCard
        enrollment={entry.displayedEnrollment}
        layout={layout}
        onUpgradeError={onUpgradeError}
        Component={Component}
        className={className}
      />
    )
  }

  if (!entry.displayedEnrollment && entry.course) {
    return (
      <UnenrolledCourseCard
        course={entry.course}
        displayedRun={entry.displayedRun ?? undefined}
        contractId={entry.contractId}
        ancestorContext={entry.ancestorContext}
        layout={layout}
        Component={Component}
        className={className}
      />
    )
  }
}

export { CoursewareCard }
