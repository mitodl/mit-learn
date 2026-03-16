import React from "react"
import { Metadata } from "next"
import { standardizeMetadata } from "@/common/metadata"
import PodcastPage from "@/app-pages/PodcastPage/PodcastPage"

export const metadata: Metadata = standardizeMetadata({
  title: "MIT Learn | Podcast",
  robots: "noindex, nofollow",
})

const Page: React.FC<PageProps<"/podcast">> = () => {
  return <PodcastPage />
}

export default Page
