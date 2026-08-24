import React from "react"
import { redirect } from "next/navigation"
import type { AppPageProps } from "@/common/searchParams"

const Page: React.FC<AppPageProps<"/news/draft">> = () => {
  redirect("/website_content/drafts?content_type=news")
}

export default Page
