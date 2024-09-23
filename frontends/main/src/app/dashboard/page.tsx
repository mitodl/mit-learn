import React from "react"
import { Metadata } from "next"
import DashboardPage from "@/app-pages/DashboardPage/DashboardPage"
import { standardizeMetadata } from "@/common/metadata"
export const metadata: Metadata = standardizeMetadata({
  title: "Your MIT Learning Journey",
  social: false,
})

const Page: React.FC = () => {
  return <DashboardPage />
}

export default Page