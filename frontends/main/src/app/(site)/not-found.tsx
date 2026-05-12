import React from "react"
import NotFoundPage from "@/app-pages/ErrorPage/NotFoundPage"
import { standardizeMetadata } from "@/common/metadata"
import type { Metadata } from "next"

export const metadata: Metadata = standardizeMetadata({
  title: "Not Found",
  social: false,
})

const Page: React.FC = () => {
  return <NotFoundPage />
}

export default Page
