import React from "react"
import { Metadata } from "next"
import CertificatePage from "@/app-pages/CertificatePage/CertificatePage"
import { certificateQueries } from "api/mitxonline-hooks/certificates"
import { HydrationBoundary, dehydrate } from "@tanstack/react-query"
import { isInEnum } from "@/common/utils"
import { notFound } from "next/navigation"
import { safeGenerateMetadata, standardizeMetadata } from "@/common/metadata"
import { getQueryClient } from "@/app/getQueryClient"

const NEXT_PUBLIC_ORIGIN = process.env.NEXT_PUBLIC_ORIGIN

enum CertificateType {
  Course = "course",
  Program = "program",
}

export async function generateMetadata({
  params,
}: PageProps<"/certificate/[certificateType]/[uuid]">): Promise<Metadata> {
  const { certificateType, uuid } = await params

  return safeGenerateMetadata(async () => {
    let title, displayType, userName

    const queryClient = getQueryClient()

    if (certificateType === CertificateType.Course) {
      const data = await queryClient.fetchQueryOr404(
        certificateQueries.courseCertificatesRetrieve({
          cert_uuid: uuid,
        }),
      )

      title = data.course_run.course.title

      displayType = "Module Certificate"

      userName = data?.user?.name
    } else {
      const data = await queryClient.fetchQueryOr404(
        certificateQueries.programCertificatesRetrieve({
          cert_uuid: uuid,
        }),
      )

      title = data.program.title

      displayType = `${data.program.program_type} Certificate`

      userName = data.user.name
    }

    return standardizeMetadata({
      title: `${userName}'s ${displayType}`,
      description: `${userName} has successfully completed the Universal Artificial Intelligence ${displayType}: ${title}`,
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
        cert_uuid: uuid,
      }),
    )
  } else {
    await queryClient.fetchQueryOr404(
      certificateQueries.programCertificatesRetrieve({
        cert_uuid: uuid,
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
