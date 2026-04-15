import { enrollmentQueries, enrollmentKeys } from "./queries"
import { useMutation, useQueryClient } from "@tanstack/react-query"
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

const useCreateB2bEnrollment = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (opts: B2bApiB2bEnrollCreateRequest) =>
      b2bApi.b2bEnrollCreate(opts),
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: enrollmentKeys.courseRunEnrollmentsList(),
      })
    },
  })
}

const useCreateEnrollment = () => {
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
  })
}

const useUpdateEnrollment = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (opts: EnrollmentsApiEnrollmentsPartialUpdateRequest) =>
      courseRunEnrollmentsApi.enrollmentsPartialUpdate(opts),
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: enrollmentKeys.courseRunEnrollmentsList(),
      })
    },
  })
}

const useDestroyEnrollment = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (enrollmentId: number) =>
      courseRunEnrollmentsApi.enrollmentsDestroy({ id: enrollmentId }),
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: enrollmentKeys.courseRunEnrollmentsList(),
      })
    },
  })
}

const useDestroyProgramEnrollment = () => {
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
  })
}

const useCreateProgramEnrollment = () => {
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
  })
}

const useCreateVerifiedProgramEnrollment = () => {
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
