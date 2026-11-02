import React from "react"
import type { Metadata } from "next"
import type { AppPageProps } from "@/common/searchParams"
import { HydrationBoundary, dehydrate } from "@tanstack/react-query"
import { programLetterQueries } from "api/hooks/programLetters"
import { getQueryClient } from "@/app/getQueryClient"
import { safeGenerateMetadata, standardizeMetadata } from "@/common/metadata"
import ProgramLetterPage from "@/app-pages/ProgramLetterPage/ProgramLetterPage"

type Props = AppPageProps<"/program_letter/[id]/view">

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params

  return safeGenerateMetadata(async () => {
    // fetchQuery, not fetchQueryOr404: notFound() throws an error that
    // safeGenerateMetadata would swallow and report as a metadata failure.
    // A 404 from the API is turned into notFound() by safeGenerateMetadata.
    const { certificate } = await getQueryClient().fetchQuery(
      programLetterQueries.detail(id),
    )
    const userName = certificate.user_full_name
    return standardizeMetadata({
      title: userName ? `${userName}'s Program Letter` : "Program Letter",
      description: userName
        ? `${userName} has successfully completed: ${certificate.program_title}`
        : `Program letter for ${certificate.program_title}`,
      robots: { index: false },
    })
  })
}

const Page: React.FC<Props> = async ({ params }) => {
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
