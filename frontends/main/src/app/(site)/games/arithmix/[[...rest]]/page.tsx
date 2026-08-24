import type { AppPageProps } from "@/common/searchParams"
import React from "react"
import { Metadata } from "next"
import { standardizeMetadata } from "@/common/metadata"
import ArithmixClient from "./ArithmixClient"

export const metadata: Metadata = standardizeMetadata({
  title: "Arithmix",
})

const Page: React.FC<AppPageProps<"/games/arithmix/[[...rest]]">> = () => {
  return <ArithmixClient />
}

export default Page
