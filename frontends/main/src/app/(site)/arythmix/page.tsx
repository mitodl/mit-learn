import React from "react"
import { Metadata } from "next"
import { standardizeMetadata } from "@/common/metadata"
import { Arithmix } from "numbers-puzzle-game"

export const metadata: Metadata = standardizeMetadata({
  title: "Arythmix",
})

const Page: React.FC<PageProps<"/arythmix">> = () => {
  return <Arithmix />
}

export default Page
