import type {
  BaseCourseRun,
  CourseRunEnrollmentV3,
  CourseWithCourseRunsSerializerV2,
  V3UserProgramEnrollment,
} from "@mitodl/mitxonline-api-axios/v2"
import type { DashboardCourseEntry } from "./dashboardViewModel"

export type LegacyDashboardCardResource =
  | { type: "course"; data: CourseWithCourseRunsSerializerV2 }
  | { type: "courserun-enrollment"; data: CourseRunEnrollmentV3 }

export type LegacyDashboardCardAdapterOutput = {
  resource: LegacyDashboardCardResource
  selectedCourseRun: BaseCourseRun | null
  buttonHref: string | null
  contractId?: number
  programEnrollment?: V3UserProgramEnrollment
  parentProgramReadableIds?: string[]
}

const adaptCourseEntryToLegacyDashboardCardProps = (
  entry: DashboardCourseEntry,
): LegacyDashboardCardAdapterOutput => {
  return {
    resource: entry.displayedEnrollment
      ? {
          type: "courserun-enrollment",
          data: entry.displayedEnrollment,
        }
      : {
          type: "course",
          data: entry.course,
        },
    selectedCourseRun: entry.displayedRun,
    buttonHref:
      entry.displayedEnrollment?.run.courseware_url ??
      entry.displayedRun?.courseware_url ??
      null,
    contractId: entry.contractId,
    programEnrollment: entry.ancestorContext?.programEnrollment,
    parentProgramReadableIds: entry.ancestorContext?.parentProgramReadableIds,
  }
}

export { adaptCourseEntryToLegacyDashboardCardProps }
