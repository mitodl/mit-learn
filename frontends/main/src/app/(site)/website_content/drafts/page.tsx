import React from "react"
import { Metadata } from "next"
import { standardizeMetadata } from "@/common/metadata"
import { WebsiteContentDraftListingPage } from "@/app-pages/WebsiteContent/WebsiteContentDraftListingPage"

export const metadata: Metadata = standardizeMetadata({
  title: "MIT Learn | Drafts",
  robots: "noindex, nofollow",
})

const Page = async ({
  searchParams,
}: {
  searchParams: Promise<{ content_type?: string }>
}) => {
  const { content_type: contentType } = await searchParams
  return <WebsiteContentDraftListingPage contentType={contentType} />
}

export default Page
