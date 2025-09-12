import React from "react"
import { UserListDetailsContent } from "@/app-pages/DashboardPage/UserListDetailsContent"
import { notFound } from "next/navigation"

const Page: React.FC<PageProps<"/dashboard/my-lists/[id]">> = async ({
  params,
}) => {
  const resolved = await params
  const id = Number(resolved.id)
  if (Number.isNaN(id)) {
    notFound()
  }

  return <UserListDetailsContent userListId={id} />
}

export default Page
