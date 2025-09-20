import React from "react"
import { Metadata } from "next"
import CertificatePage from "@/app-pages/CertificatePage/CertificatePage"
import { prefetch } from "api/ssr/prefetch"
import { certificateQueries } from "api/mitxonline-hooks/certificates"
import { HydrationBoundary } from "@tanstack/react-query"
import { isInEnum } from "@/common/utils"
import { notFound } from "next/navigation"
import { standardizeMetadata } from "@/common/metadata"
import { courseCertificatesApi, programCertificatesApi } from "api/mitxonline"
import * as Sentry from "@sentry/nextjs"

const { NEXT_PUBLIC_ORIGIN } = process.env

enum CertificateType {
  Course = "course",
  Program = "program",
}

export async function generateMetadata({
  params,
}: PageProps<"/certificate/[certificateType]/[uuid]">): Promise<Metadata> {
  const { certificateType, uuid } = await params

  let title, displayType, userName

  try {
    if (certificateType === CertificateType.Course) {
      const { data } = await courseCertificatesApi.courseCertificatesRetrieve({
        cert_uuid: uuid,
      })

      title = data.course_run.course.title

      displayType = "Module Certificate"

      userName = data?.user?.name
    } else {
      const { data } = await programCertificatesApi.programCertificatesRetrieve(
        {
          cert_uuid: uuid,
        },
      )

      title = data.program.title

      displayType = `${data.program.program_type} Certificate`

      userName = data.user.name
    }
  } catch (error) {
    Sentry.captureException(error)
    console.error("Error fetching certificate for metadata", {
      certificateType,
      uuid,
      error,
    })
    return standardizeMetadata({})
  }

  return standardizeMetadata({
    title: `${userName}'s ${displayType}`,
    description: `${userName} has successfully completed the Universal Artificial Intelligence ${displayType}: ${title}`,
  })
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
      <CertificatePage
        certificateType={certificateType}
        uuid={uuid}
        pageUrl={`${NEXT_PUBLIC_ORIGIN}/certificate/${certificateType}/${uuid}`}
      />
    </HydrationBoundary>
  )
}

export default Page
