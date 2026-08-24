import React from "react"
import { Metadata } from "next"
import { UnsubscribePage } from "@/app-pages/UnsubscribePage/UnsubscribePage"
import { standardizeMetadata } from "@/common/metadata"
import type { AppPageProps } from "@/common/searchParams"

export const metadata: Metadata = standardizeMetadata({
  title: "Unsubscribe",
})

const Page = async ({ searchParams }: AppPageProps<"/unsubscribe">) => {
  const { token } = await searchParams
  return (
    <UnsubscribePage token={typeof token === "string" ? token : undefined} />
  )
}

export default Page
