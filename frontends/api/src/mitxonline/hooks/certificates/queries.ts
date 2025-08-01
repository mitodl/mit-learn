import { queryOptions } from "@tanstack/react-query"
import type {
  CourseCertificatesApiCourseCertificatesRetrieveRequest,
  ProgramCertificatesApiProgramCertificatesRetrieveRequest,
  V2CourseRunCertificate,
  V2ProgramCertificate,
} from "@mitodl/mitxonline-api-axios/v2"
import { courseCertificatesApi, programCertificatesApi } from "../../clients"

const certificateKeys = {
  root: ["mitxonline", "certificates"],
  courseCertificatesRetrieve: (
    opts?: CourseCertificatesApiCourseCertificatesRetrieveRequest,
  ) => [...certificateKeys.root, "retrieve", opts],
  programCertificatesRetrieve: (
    opts?: ProgramCertificatesApiProgramCertificatesRetrieveRequest,
  ) => [...certificateKeys.root, "retrieve", opts],
}

const certificateQueries = {
  courseCertificatesRetrieve: (
    opts: CourseCertificatesApiCourseCertificatesRetrieveRequest,
  ) =>
    queryOptions({
      queryKey: certificateKeys.courseCertificatesRetrieve(opts),
      queryFn: async (): Promise<V2CourseRunCertificate> => {
        return courseCertificatesApi
          .courseCertificatesRetrieve(opts)
          .then((res) => res.data)
      },
    }),
  programCertificatesRetrieve: (
    opts: ProgramCertificatesApiProgramCertificatesRetrieveRequest,
  ) =>
    queryOptions({
      queryKey: certificateKeys.programCertificatesRetrieve(opts),
      queryFn: async (): Promise<V2ProgramCertificate> => {
        return programCertificatesApi
          .programCertificatesRetrieve(opts)
          .then((res) => res.data)
      },
    }),
}

export { certificateQueries, certificateKeys }
