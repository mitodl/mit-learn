import React from "react"
import CertificatePage from "@/app-pages/CertificatePage/CertificatePage"
import { isInEnum } from "@/common/utils"
import { notFound } from "next/navigation"

enum CertificateType {
  Course = "course",
  Program = "program",
}

const Page: React.FC<
  PageProps<"/certificate/[certificateType]/[uuid]">
> = async ({ params }) => {
  const { certificateType } = await params

  if (!isInEnum(certificateType, CertificateType)) {
    notFound()
  }

  return <CertificatePage />
}

export default Page
