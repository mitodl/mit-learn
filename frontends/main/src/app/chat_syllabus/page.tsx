import React from "react"
import { Metadata } from "next"

import ChatSyllabusPage from "@/app-pages/ChatSyllabusPage/ChatSyllabusPage"
import { standardizeMetadata } from "@/common/metadata"

export const metadata: Metadata = standardizeMetadata({
  title: "Chat Syllabus Demo",
  robots: "noindex",
})

const Page: React.FC = () => {
  return <ChatSyllabusPage />
}

export default Page
