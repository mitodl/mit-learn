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
import { adaptCourseEntryToLegacyDashboardCardProps } from "./model/dashboardAdapters"
import type { DashboardCourseEntry } from "./model/dashboardViewModel"
import { DashboardCard } from "./DashboardCard"
import { DashboardCard as ModuleCardInner } from "./ModuleCard"

// Re-export the card root so OrganizationCards.tsx can migrate in Phase 7c.
export { DashboardCardRoot as CoursewareCardRoot } from "./DashboardCard"

// ---------------------------------------------------------------------------
// Prop types
// ---------------------------------------------------------------------------

type CoursewareCardBaseProps = {
  entry: DashboardCourseEntry
  className?: string
  Component?: React.ElementType
}

/** Props for the default course / enrollment card display. */
type CoursewareCardDefaultProps = CoursewareCardBaseProps & {
  layout?: "default" | "stacked"
  showNotComplete?: boolean
  offerUpgrade?: boolean
  isLoading?: boolean
  onUpgradeError?: (error: string) => void
  contextMenuItems?: SimpleMenuItem[]
}

/**
 * Props for the `moduleRow` variant — a compact stacked card used as a row
 * inside a `ProgramAsCourseCard` module list.
 *
 * `useVerifiedEnrollment` and `parentProgramIds` are read from
 * `entry.ancestorContext` so callers only need to embed them there (via
 * `buildCourseEntry`).
 */
type CoursewareCardModuleRowProps = CoursewareCardBaseProps & {
  layout: "moduleRow"
  headingLevel?: "h2" | "h3" | "h4" | "h5" | "h6"
}

export type CoursewareCardProps =
  | CoursewareCardDefaultProps
  | CoursewareCardModuleRowProps

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const CoursewareCard: React.FC<CoursewareCardProps> = (props) => {
  const { entry, Component, className } = props

  // ── moduleRow arm ────────────────────────────────────────────────────────
  if (props.layout === "moduleRow") {
    const { headingLevel } = props

    const resource = entry.displayedEnrollment
      ? {
          type: "courserun-enrollment" as const,
          data: entry.displayedEnrollment,
        }
      : { type: "course" as const, data: entry.course }

    return (
      <ModuleCardInner
        resource={resource}
        useVerifiedEnrollment={entry.ancestorContext?.useVerifiedEnrollment}
        parentProgramIds={entry.ancestorContext?.parentProgramReadableIds}
        variant="stacked"
        headingLevel={headingLevel}
        Component={Component}
        className={className}
      />
    )
  }

  // ── default / stacked arm ────────────────────────────────────────────────
  const {
    showNotComplete,
    offerUpgrade,
    isLoading,
    onUpgradeError,
    contextMenuItems,
    layout,
  } = props

  const adapted = adaptCourseEntryToLegacyDashboardCardProps(entry)

  return (
    <DashboardCard
      resource={adapted.resource}
      selectedCourseRun={adapted.selectedCourseRun}
      contractId={adapted.contractId}
      programEnrollment={adapted.programEnrollment}
      showNotComplete={showNotComplete}
      offerUpgrade={offerUpgrade}
      isLoading={isLoading}
      onUpgradeError={onUpgradeError}
      contextMenuItems={contextMenuItems}
      variant={layout}
      Component={Component}
      className={className}
    />
  )
}

export { CoursewareCard }
