import type { AppPageProps } from "@/common/searchParams"
import React from "react"
import { Metadata } from "next"
import { standardizeMetadata } from "@/common/metadata"
import HonorCodePage from "@/app-pages/HonorCodePage/HonorCodePage"

export const metadata: Metadata = standardizeMetadata({
  title: "Honor Code",
})

const Page: React.FC<AppPageProps<"/honor_code">> = () => {
  return <HonorCodePage />
}

export default Page
