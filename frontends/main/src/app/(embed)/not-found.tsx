import React from "react"
import EmbedNotFoundPage from "@/app-pages/VideoEmbedPage/EmbedNotFoundPage"
import { standardizeMetadata } from "@/common/metadata"
import type { Metadata } from "next"

export const metadata: Metadata = standardizeMetadata({
  title: "Not Found",
  social: false,
})

const NotFound: React.FC = () => {
  return <EmbedNotFoundPage />
}

export default NotFound
