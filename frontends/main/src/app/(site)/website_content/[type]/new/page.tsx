import React from "react"
import { Metadata } from "next"
import { standardizeMetadata } from "@/common/metadata"
import { WebsiteContentNewPage } from "@/app-pages/WebsiteContent/WebsiteContentNewPage"

export const metadata: Metadata = standardizeMetadata({
  title: "MIT Learn | New",
  robots: "noindex, nofollow",
})

const Page = async ({ params }: { params: Promise<{ type: string }> }) => {
  const { type } = await params
  return <WebsiteContentNewPage type={type} />
}

export default Page
