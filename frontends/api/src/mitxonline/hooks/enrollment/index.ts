import { enrollmentQueries, enrollmentKeys } from "./queries"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { MutationHookOptions } from "../../../mutations/mutationMeta"
import {
  b2bApi,
  courseRunEnrollmentsApi,
  courseRunsV3Api,
  programEnrollmentsApi,
  programsV3Api,
  verifiedProgramEnrollmentsApi,
} from "../../clients"
import { B2bApiB2bEnrollCreateRequest } from "@mitodl/mitxonline-api-axios/v0"
import {
  EnrollmentsApiEnrollmentsPartialUpdateRequest,
  CourseRunEnrollmentRequest,
} from "@mitodl/mitxonline-api-axios/v1"
import { VerifiedProgramEnrollmentsApiVerifiedProgramEnrollmentsCreateRequest } from "@mitodl/mitxonline-api-axios/v2"
import type { EnrollmentEligibility } from "@mitodl/mitxonline-api-axios/v3"
import {
  ProgramEnrollmentsApiV3ProgramEnrollmentsCreateRequest,
  ProgramEnrollmentsApiV3ProgramEnrollmentsPartialUpdateRequest,
} from "@mitodl/mitxonline-api-axios/v3"

/** A course run or program a learner can enroll in or buy. */
type EnrollmentTarget = { type: "course_run" | "program"; id: number }

/**
 * Whether the learner may enroll in `target`, without enrolling them. MITx
 * Online runs the same export compliance check enrollment and checkout do.
 *
 * `missing_fields` (with `reason_code` CS_701: the profile fields to fix) is
 * newer than this client version, so it is typed here until the client
 * catches up.
 */
const checkEnrollmentEligibility = async (
  target: EnrollmentTarget,
): Promise<EnrollmentEligibility & { missing_fields?: string[] }> => {
  const { data } =
    target.type === "program"
      ? await programsV3Api.programsEnrollmentEligible({
          program_id: target.id,
        })
      : await courseRunsV3Api.courseRunsEnrollmentEligible({
          run_id: target.id,
        })
  return data
}

const useCreateB2bEnrollment = ({ meta }: MutationHookOptions = {}) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (opts: B2bApiB2bEnrollCreateRequest) =>
      b2bApi.b2bEnrollCreate(opts),
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: enrollmentKeys.courseRunEnrollmentsList(),
      })
    },
    meta,
  })
}

const useCreateEnrollment = ({ meta }: MutationHookOptions = {}) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (opts: CourseRunEnrollmentRequest) => {
      return courseRunEnrollmentsApi.enrollmentsCreate({
        CourseRunEnrollmentRequest: opts,
      })
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: enrollmentKeys.courseRunEnrollmentsList(),
      })
      queryClient.invalidateQueries({
        queryKey: enrollmentKeys.programEnrollmentsList(),
      })
    },
    meta,
  })
}

const useUpdateEnrollment = ({ meta }: MutationHookOptions = {}) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (opts: EnrollmentsApiEnrollmentsPartialUpdateRequest) =>
      courseRunEnrollmentsApi.enrollmentsPartialUpdate(opts),
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: enrollmentKeys.courseRunEnrollmentsList(),
      })
    },
    meta,
  })
}

const useDestroyEnrollment = ({ meta }: MutationHookOptions = {}) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (enrollmentId: number) =>
      courseRunEnrollmentsApi.enrollmentsDestroy({ id: enrollmentId }),
    onSuccess: (_data, enrollmentId) => {
      queryClient.setQueryData(
        enrollmentQueries.courseRunEnrollmentsList().queryKey,
        (data) => data?.filter((enrollment) => enrollment.id !== enrollmentId),
      )
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: enrollmentKeys.courseRunEnrollmentsList(),
      })
    },
    meta,
  })
}

const useDestroyProgramEnrollment = ({ meta }: MutationHookOptions = {}) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (programId: number) =>
      programEnrollmentsApi.v3ProgramEnrollmentsDestroy({
        program_id: programId,
      }),
    onSuccess: (_data, vars) => {
      queryClient.setQueryData(
        enrollmentQueries.programEnrollmentsList().queryKey,
        (data) => data?.filter((enrollment) => enrollment.program.id !== vars),
      )
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: enrollmentKeys.programEnrollmentsList(),
      })
    },
    meta,
  })
}

const useCreateProgramEnrollment = ({ meta }: MutationHookOptions = {}) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (
      opts: ProgramEnrollmentsApiV3ProgramEnrollmentsCreateRequest,
    ) => programEnrollmentsApi.v3ProgramEnrollmentsCreate(opts),
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: enrollmentKeys.programEnrollmentsList(),
      })
    },
    meta,
  })
}

const useUpdateProgramEnrollmentTrack = ({
  meta,
}: MutationHookOptions = {}) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (
      opts: ProgramEnrollmentsApiV3ProgramEnrollmentsPartialUpdateRequest,
    ) => programEnrollmentsApi.v3ProgramEnrollmentsPartialUpdate(opts),
    onSuccess: (response) => {
      queryClient.setQueryData(
        enrollmentQueries.programEnrollmentsList().queryKey,
        (data) =>
          data?.map((enrollment) =>
            enrollment.program.id === response.data.program.id
              ? response.data
              : enrollment,
          ),
      )
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: enrollmentKeys.programEnrollmentsList(),
      })
    },
    meta,
  })
}

const useCreateVerifiedProgramEnrollment = ({
  meta,
}: MutationHookOptions = {}) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (
      opts: VerifiedProgramEnrollmentsApiVerifiedProgramEnrollmentsCreateRequest,
    ) => verifiedProgramEnrollmentsApi.verifiedProgramEnrollmentsCreate(opts),
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: enrollmentKeys.courseRunEnrollmentsList(),
      })
      queryClient.invalidateQueries({
        queryKey: enrollmentKeys.programEnrollmentsList(),
      })
    },
    meta,
  })
}

export type { EnrollmentTarget }
export {
  checkEnrollmentEligibility,
  enrollmentQueries,
  enrollmentKeys,
  useCreateB2bEnrollment,
  useCreateEnrollment,
  useUpdateEnrollment,
  useDestroyEnrollment,
  useDestroyProgramEnrollment,
  useCreateProgramEnrollment,
  useUpdateProgramEnrollmentTrack,
  useCreateVerifiedProgramEnrollment,
}
