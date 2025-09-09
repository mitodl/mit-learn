import React from "react"
import { UserListDetailsContent } from "@/app-pages/DashboardPage/UserListDetailsContent"
import invariant from "tiny-invariant"
import { PageParams } from "@/app/types"

const Page: React.FC<PageParams<never, { id: string }>> = async ({
  params,
}) => {
  const resolved = await params!
  const id = Number(resolved.id)
  invariant(id, "id is required")
  return <UserListDetailsContent userListId={id} />
}

export default Page
