import React from "react"
import { Metadata } from "next"
import { standardizeMetadata } from "@/common/metadata"
import invariant from "tiny-invariant"
import { Permission } from "api/hooks/user"
import RestrictedRoute from "@/components/RestrictedRoute/RestrictedRoute"
import B2BAttachPage from "@/app-pages/B2BAttachPage/B2BAttachPage"

export const metadata: Metadata = standardizeMetadata({
  title: "Use Enrollment Code",
})

const Page: React.FC<PageProps<"/attach/[code]">> = async ({ params }) => {
  const resolved = await params
  invariant(resolved?.code, "code is required")
  return (
    <RestrictedRoute requires={Permission.Authenticated}>
      <B2BAttachPage code={resolved?.code} />
    </RestrictedRoute>
  )
}

export default Page
