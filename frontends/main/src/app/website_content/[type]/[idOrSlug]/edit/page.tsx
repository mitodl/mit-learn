import React from "react"
import { WebsiteContentEditPage } from "@/app-pages/WebsiteContent/WebsiteContentEditPage"

const Page = async ({
  params,
}: {
  params: Promise<{ type: string; idOrSlug: string }>
}) => {
  const { type, idOrSlug } = await params
  return <WebsiteContentEditPage type={type} idOrSlug={idOrSlug} />
}

export default Page
