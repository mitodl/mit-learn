import type { AppPageProps } from "@/common/searchParams"
import React from "react"
import { Metadata } from "next"
import { standardizeMetadata } from "@/common/metadata"
import { PodcastsListingPage } from "@/app-pages/PodcastPage/PodcastsListingPage"

export const metadata: Metadata = standardizeMetadata({
  title: "Podcasts",
})

const Page: React.FC<AppPageProps<"/podcasts">> = () => {
  return <PodcastsListingPage />
}

export default Page
