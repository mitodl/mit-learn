import React from "react"
import { Metadata } from "next"
import { standardizeMetadata } from "@/common/metadata"
import { PodcastsListingPage } from "@/app-pages/PodcastPage/PodcastsListingPage"

export const metadata: Metadata = standardizeMetadata({
  title: "Podcasts",
})

const Page: React.FC<PageProps<"/podcasts">> = () => {
  return <PodcastsListingPage />
}

export default Page
