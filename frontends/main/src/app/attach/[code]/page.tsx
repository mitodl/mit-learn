import React from "react"
import { Metadata } from "next"
import { standardizeMetadata } from "@/common/metadata"
import invariant from "tiny-invariant"
import B2BAttachPage from "@/app-pages/B2BAttachPage/B2BAttachPage"

export const metadata: Metadata = standardizeMetadata({
  title: "Use Enrollment Code",
})

const Page: React.FC<PageProps<"/attach/[code]">> = async ({ params }) => {
  const resolved = await params
  invariant(resolved?.code, "code is required")
  return <B2BAttachPage code={resolved?.code} />
}

export default Page
