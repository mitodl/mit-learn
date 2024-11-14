import React from "react"
import { Metadata } from "next"
import { Hydrate } from "@tanstack/react-query"
import { prefetch } from "api/ssr/prefetch"
import { standardizeMetadata } from "@/common/metadata"
import { channels } from "api/hooks/channels"
import UnitsListingPage from "@/app-pages/UnitsListingPage/UnitsListingPage"

export const metadata: Metadata = standardizeMetadata({
  title: "Units",
})

const Page: React.FC = async () => {
  const { dehydratedState } = await prefetch([
    channels.countsByType("unit"),
    channels.list({ channel_type: "unit" }),
  ])

  return (
    <Hydrate state={dehydratedState}>
      <UnitsListingPage />
    </Hydrate>
  )
}

export default Page
