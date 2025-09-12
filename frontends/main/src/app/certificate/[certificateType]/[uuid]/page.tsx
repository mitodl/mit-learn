import React from "react"
import CertificatePage from "@/app-pages/CertificatePage/CertificatePage"
import { prefetch } from "api/ssr/prefetch"
import { certificateQueries } from "api/mitxonline-hooks/certificates"
import { HydrationBoundary } from "@tanstack/react-query"
import { isInEnum } from "@/common/utils"
import { notFound } from "next/navigation"

enum CertificateType {
  Course = "course",
  Program = "program",
}

const Page: React.FC<
  PageProps<"/certificate/[certificateType]/[uuid]">
> = async ({ params }) => {
  const { certificateType, uuid } = await params

  if (!isInEnum(certificateType, CertificateType)) {
    notFound()
  }

  const { dehydratedState } = await prefetch([
    certificateType === CertificateType.Course
      ? certificateQueries.courseCertificatesRetrieve({
          cert_uuid: uuid,
        })
      : certificateQueries.programCertificatesRetrieve({
          cert_uuid: uuid,
        }),
  ])

  return (
    <HydrationBoundary state={dehydratedState}>
      <CertificatePage certificateType={certificateType} uuid={uuid} />
    </HydrationBoundary>
  )
}

export default Page
