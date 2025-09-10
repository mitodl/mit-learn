import React from "react"
import { notFound } from "next/navigation"
import CertificatePage from "@/app-pages/CertificatePage/CertificatePage"
import { prefetch } from "api/ssr/prefetch"
import { certificateQueries } from "api/mitxonline-hooks/certificates"
import { HydrationBoundary } from "@tanstack/react-query"

enum CertificateType {
  Course = "course",
  Program = "program",
}

interface PageProps {
  params: Promise<{
    certificateType: CertificateType
    uuid: string
  }>
}

const Page: React.FC<PageProps> = async ({ params }) => {
  const { certificateType, uuid } = await params

  if (
    ![CertificateType.Course, CertificateType.Program].includes(
      certificateType as CertificateType,
    )
  ) {
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
