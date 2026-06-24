import { env } from "@/env"
import React from "react"
import { Metadata } from "next"
import CertificatePage from "@/app-pages/CertificatePage/CertificatePage"
import { certificateQueries } from "api/mitxonline-hooks/certificates"
import { HydrationBoundary, dehydrate } from "@tanstack/react-query"
import { isInEnum } from "@/common/utils"
import { notFound } from "next/navigation"
import { safeGenerateMetadata, standardizeMetadata } from "@/common/metadata"
import { getQueryClient } from "@/app/getQueryClient"
import {
  getCertificateInfo,
  getCertificateTitle,
} from "@/common/certificateUtils"

const NEXT_PUBLIC_ORIGIN = env("NEXT_PUBLIC_ORIGIN")

enum CertificateType {
  Course = "course",
  Program = "program",
}

export async function generateMetadata({
  params,
}: PageProps<"/certificate/[certificateType]/[uuid]">): Promise<Metadata> {
  const { certificateType, uuid } = await params

  return safeGenerateMetadata(async () => {
    let title, userName, displayType

    const queryClient = getQueryClient()

    if (certificateType === CertificateType.Course) {
      const data = await queryClient.fetchQueryOr404(
        certificateQueries.courseCertificatesRetrieve({
          uuid,
        }),
      )

      title = data.course_run.course.title

      userName = data?.user?.name
      displayType = getCertificateInfo().displayType
    } else {
      const data = await queryClient.fetchQueryOr404(
        certificateQueries.programCertificatesRetrieve({
          uuid,
        }),
      )

      title = getCertificateTitle(
        data.certificate_page?.product_name,
        data.program.title ?? "",
      )

      userName = data.user.name
      displayType = getCertificateInfo(data.program.program_type).displayType
    }

    return standardizeMetadata({
      title: `${userName}'s ${displayType}`,
      description: `${userName} has successfully completed: ${title}`,
      robots: { index: false },
    })
  })
}

const Page: React.FC<
  PageProps<"/certificate/[certificateType]/[uuid]">
> = async ({ params }) => {
  const { certificateType, uuid } = await params

  if (!isInEnum(certificateType, CertificateType)) {
    notFound()
  }

  const queryClient = getQueryClient()

  if (certificateType === CertificateType.Course) {
    await queryClient.fetchQueryOr404(
      certificateQueries.courseCertificatesRetrieve({
        uuid,
      }),
    )
  } else {
    await queryClient.fetchQueryOr404(
      certificateQueries.programCertificatesRetrieve({
        uuid,
      }),
    )
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <CertificatePage
        certificateType={certificateType}
        uuid={uuid}
        pageUrl={`${NEXT_PUBLIC_ORIGIN}/certificate/${certificateType}/${uuid}`}
      />
    </HydrationBoundary>
  )
}

export default Page
