import { enrollmentQueries, enrollmentKeys } from "./queries"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { MutationHookOptions } from "../../../mutations/mutationMeta"
import {
  b2bApi,
  courseRunEnrollmentsApi,
  programEnrollmentsApi,
  verifiedProgramEnrollmentsApi,
} from "../../clients"
import {
  B2bApiB2bEnrollCreateRequest,
  EnrollmentsApiEnrollmentsPartialUpdateRequest,
  CourseRunEnrollmentRequest,
  ProgramEnrollmentsApiV3ProgramEnrollmentsCreateRequest,
  VerifiedProgramEnrollmentsApiVerifiedProgramEnrollmentsCreateRequest,
} from "@mitodl/mitxonline-api-axios/v2"

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

export {
  enrollmentQueries,
  enrollmentKeys,
  useCreateB2bEnrollment,
  useCreateEnrollment,
  useUpdateEnrollment,
  useDestroyEnrollment,
  useDestroyProgramEnrollment,
  useCreateProgramEnrollment,
  useCreateVerifiedProgramEnrollment,
}
