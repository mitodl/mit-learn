import type {
  CourseRunEnrollmentV3,
  CourseRunV2,
  CourseWithCourseRunsSerializerV2,
  V3UserProgramEnrollment,
} from "@mitodl/mitxonline-api-axios/v2"
import type { DashboardCourseSlot } from "./dashboardViewModel"

export type LegacyDashboardCardResource =
  | { type: "course"; data: CourseWithCourseRunsSerializerV2 }
  | { type: "courserun-enrollment"; data: CourseRunEnrollmentV3 }

export type LegacyDashboardCardAdapterOutput = {
  resource: LegacyDashboardCardResource
  selectedCourseRun: CourseRunV2 | null
  buttonHref: string | null
  contractId?: number
  programEnrollment?: V3UserProgramEnrollment
}

const adaptCourseSlotToLegacyDashboardCardProps = (
  slot: DashboardCourseSlot,
): LegacyDashboardCardAdapterOutput => {
  return {
    resource: slot.displayedEnrollment
      ? {
          type: "courserun-enrollment",
          data: slot.displayedEnrollment,
        }
      : {
          type: "course",
          data: slot.course,
        },
    selectedCourseRun: slot.displayedRun,
    buttonHref:
      slot.displayedEnrollment?.run.courseware_url ??
      slot.displayedRun?.courseware_url ??
      null,
    contractId: slot.contractId,
    programEnrollment: slot.ancestorContext?.programEnrollment,
  }
}

export { adaptCourseSlotToLegacyDashboardCardProps }
