/**
 * @deprecated All helpers have moved to `model/dashboardViewModel.ts`.
 * This file is a re-export shim kept alive for legacy card consumers
 * (DashboardCard, ModuleCard) during Phase 7 migration. Delete with those
 * files in PR 7d.
 */
export {
  ResourceType,
  EnrollmentStatus,
  filterEnrollmentsByOrganization,
  selectBestEnrollment,
  getKey,
  getEnrollmentStatus,
  getProgramEnrollmentStatus,
  getRequirementsProgress,
} from "./model/dashboardViewModel"
export { getBestRun } from "@/common/mitxonline"
