import type { AppPageProps } from "@/common/searchParams"
import React from "react"
import ProgramLetterPage from "@/app-pages/ProgramLetterPage/ProgramLetterPage"

const Page: React.FC<AppPageProps<"/program_letter/[id]/view">> = () => {
  return <ProgramLetterPage />
}

export default Page
