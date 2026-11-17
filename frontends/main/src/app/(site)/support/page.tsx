import React from "react"
import type { Metadata } from "next"
import { standardizeMetadata } from "@/common/metadata"
import SupportPage from "@/app-pages/SupportPage/SupportPage"
import SupportFlagGate from "./SupportFlagGate"

export const metadata: Metadata = standardizeMetadata({
  title: "Support free education",
  description:
    "Help MIT keep high-quality educational resources available to learners everywhere.",
})

const Page: React.FC = () => (
  <SupportFlagGate>
    <SupportPage />
  </SupportFlagGate>
)

export default Page
