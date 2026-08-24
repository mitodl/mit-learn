import type { AppPageProps } from "@/common/searchParams"
import React from "react"
import { Metadata } from "next"
import { UAILandingPage } from "@/app-pages/UAILandingPage/UAILandingPage"
import { standardizeMetadata } from "@/common/metadata"

export const metadata: Metadata = standardizeMetadata({
  title: "Universal AI",
})

const Page: React.FC<AppPageProps<"/universal-learning/ai">> = () => {
  return <UAILandingPage />
}

export default Page
