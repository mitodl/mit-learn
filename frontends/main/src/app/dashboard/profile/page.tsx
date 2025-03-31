import React from "react"
import { Metadata } from "next"
import { standardizeMetadata } from "@/common/metadata"
import { ProfileContent } from "@/app-pages/DashboardPage/ProfileContent"

export const metadata: Metadata = standardizeMetadata({
  title: "Your MIT Learning Journey",
  social: false,
})

const Page: React.FC = () => {
  return <ProfileContent />
}

export default Page
