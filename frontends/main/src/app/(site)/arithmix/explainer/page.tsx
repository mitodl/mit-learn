import React from "react"
import { Metadata } from "next"
import { standardizeMetadata } from "@/common/metadata"
import ExplainerClient from "./ExplainerClient"

export const metadata: Metadata = standardizeMetadata({
  title: "Arithmix Explainer",
})

const Page: React.FC<PageProps<"/arithmix/explainer">> = () => {
  return <ExplainerClient />
}

export default Page
