import React from "react"
import { redirect } from "next/navigation"
import type { AppPageProps } from "@/common/searchParams"

const Page: React.FC<AppPageProps<"/news/new">> = () => {
  redirect("/website_content/news/new")
}

export default Page
