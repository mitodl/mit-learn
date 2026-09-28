import React from "react"
import { Metadata } from "next"
import { standardizeMetadata } from "@/common/metadata"
import { WebsiteContentDraftListingPage } from "@/app-pages/WebsiteContent/WebsiteContentDraftListingPage"
import { toContentType } from "@/common/website_content"
import type { AppPageProps } from "@/common/searchParams"

export const metadata: Metadata = standardizeMetadata({
  title: "MIT Learn | Drafts",
  robots: "noindex, nofollow",
})

const Page = async ({
  searchParams,
}: AppPageProps<"/website_content/drafts">) => {
  const { content_type: contentType } = await searchParams
  return (
    <WebsiteContentDraftListingPage
      contentType={toContentType(
        typeof contentType === "string" ? contentType : undefined,
      )}
    />
  )
}

export default Page
