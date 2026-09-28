import type { AppPageProps } from "@/common/searchParams"
import React from "react"
import { standardizeMetadata } from "@/common/metadata"
import { WebsiteContentDetail } from "@/app-pages/WebsiteContent/WebsiteContentDetail"
import RestrictedRoute from "@/components/RestrictedRoute/RestrictedRoute"
import { Permission } from "api/hooks/user"

export const generateMetadata = async () => {
  return standardizeMetadata({
    title: "Draft Article",
  })
}

const Page: React.FC<AppPageProps<"/articles/[slugOrId]/draft">> = async (
  props,
) => {
  const { slugOrId } = await props.params

  return (
    <RestrictedRoute requires={Permission.ArticleEditor}>
      <WebsiteContentDetail contentId={slugOrId} learningResourceIds={[]} />
    </RestrictedRoute>
  )
}

export default Page
