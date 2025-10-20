import React from "react"
import { Metadata } from "next"
import { standardizeMetadata } from "@/common/metadata"
import invariant from "tiny-invariant"
import EnrollmentCodePage from "@/app-pages/EnrollmentCodePage/EnrollmentCodePage"

export const metadata: Metadata = standardizeMetadata({
  title: "Use Enrollment Code",
})

const Page: React.FC<PageProps<"/enrollmentcode/[code]">> = async ({
  params,
}) => {
  const resolved = await params
  invariant(resolved?.code, "code is required")
  return <EnrollmentCodePage code={resolved?.code} />
}

export default Page
