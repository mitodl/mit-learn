import React from "react"
import { Metadata } from "next"
import { UnsubscribePage } from "@/app-pages/UnsubscribePage/UnsubscribePage"
import { standardizeMetadata } from "@/common/metadata"

export const metadata: Metadata = standardizeMetadata({
  title: "Unsubscribe",
})

const Page = async ({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) => {
  const { token } = await searchParams
  return <UnsubscribePage token={token} />
}

export default Page
