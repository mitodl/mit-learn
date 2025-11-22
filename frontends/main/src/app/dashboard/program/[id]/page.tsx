import React from "react"
import ProgramContent from "@/app-pages/DashboardPage/ProgramContent"
import { notFound } from "next/navigation"

const Page: React.FC<PageProps<"/dashboard/program/[id]">> = async ({
  params,
}) => {
  const resolved = await params
  const id = Number(resolved.id)
  if (Number.isNaN(id)) {
    notFound()
  }

  return <ProgramContent programId={id} />
}

export default Page
