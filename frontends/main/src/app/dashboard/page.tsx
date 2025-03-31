import React from "react"
import { Metadata } from "next"
import HomeContent from "@/app-pages/DashboardPage/HomeContent"
import { standardizeMetadata } from "@/common/metadata"

export const metadata: Metadata = standardizeMetadata({
  title: "Your MIT Learning Journey",
  social: false,
})

const Page: React.FC = () => {
  return <HomeContent />
}

export default Page
