import React from "react"
import { UserListDetailsContent } from "@/app-pages/DashboardPage/UserListDetailsContent"
import { PageParams } from "@/app/types"
import invariant from "tiny-invariant"

const Page: React.FC<PageParams<object, { id: number }>> = async ({
  params,
}) => {
  const resolved = await params
  invariant(resolved?.id, "id is required")
  return <UserListDetailsContent userListId={resolved.id} />
}

export default Page
