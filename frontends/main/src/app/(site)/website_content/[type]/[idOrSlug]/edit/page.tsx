import React from "react"
import { WebsiteContentEditPage } from "@/app-pages/WebsiteContent/WebsiteContentEditPage"
import type { AppPageProps } from "@/common/searchParams"

const Page = async ({
  params,
}: AppPageProps<"/website_content/[type]/[idOrSlug]/edit">) => {
  const { type, idOrSlug } = await params
  return <WebsiteContentEditPage type={type} idOrSlug={idOrSlug} />
}

export default Page
