import React from "react"
import type { AppPageProps } from "@/common/searchParams"
import { HydrationBoundary, dehydrate } from "@tanstack/react-query"
import { programLetterQueries } from "api/hooks/programLetters"
import { getQueryClient } from "@/app/getQueryClient"
import ProgramLetterPage from "@/app-pages/ProgramLetterPage/ProgramLetterPage"

const Page: React.FC<AppPageProps<"/program_letter/[id]/view">> = async ({
  params,
}) => {
  const { id } = await params
  const queryClient = getQueryClient()

  // A missing letter, or one whose certificate was revoked, 404s here so the
  // page itself is served with a 404 status.
  await queryClient.fetchQueryOr404(programLetterQueries.detail(id))

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ProgramLetterPage />
    </HydrationBoundary>
  )
}

export default Page
