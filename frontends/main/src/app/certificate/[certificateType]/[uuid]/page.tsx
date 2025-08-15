import React from "react"
import { notFound } from "next/navigation"
import CertificatePage from "@/app-pages/CertificatePage/CertificatePage"

enum CertificateType {
  Course = "course",
  Program = "program",
}

interface PageProps {
  params: {
    certificateType: CertificateType
    uuid: string
  }
}

const Page: React.FC<PageProps> = async ({ params }) => {
  const { certificateType } = await params

  if (
    ![CertificateType.Course, CertificateType.Program].includes(
      certificateType as CertificateType,
    )
  ) {
    notFound()
  }

  return <CertificatePage />
}

export default Page
