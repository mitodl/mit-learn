import React from "react"
import { WebsiteContentDetail } from "@/app-pages/WebsiteContent/WebsiteContentDetail"
import { standardizeMetadata } from "@/common/metadata"
import RestrictedRoute from "@/components/RestrictedRoute/RestrictedRoute"
import { Permission } from "api/hooks/user"

export const generateMetadata = async () => {
  return standardizeMetadata({
    title: "Draft News",
  })
}

const Page: React.FC<PageProps<"/news/[slugOrId]/draft">> = async (props) => {
  const { slugOrId } = await props.params

  // No prefetching for draft News - the client-side component
  // will fetch with user authentication

  return (
    <RestrictedRoute requires={Permission.ArticleEditor}>
      <WebsiteContentDetail articleId={slugOrId} learningResourceIds={[]} />
    </RestrictedRoute>
  )
}
export default Page
