import React from "react"
import { Hydrate } from "@tanstack/react-query"
import LearningResourceDrawer from "@/page-components/LearningResourceDrawer/LearningResourceDrawer"
import { getMetadataAsync } from "@/common/metadata"
import type { Metadata } from "next"
import { prefetch } from "api/ssr/prefetch"
import { learningResources } from "api/hooks/learningResources"

export async function generateMetadata({
  params,
}: {
  params: Promise<{
    [key: string]: string | string[] | undefined
  }>
}): Promise<Metadata> {
  console.log(">>>>>>..SLOT", await params)
  return await getMetadataAsync({
    title: "Learn with MIT",
    searchParams: params,
  })
}

const Page: React.FC = async ({
  params,
}: {
  params?: Promise<Record<string, never>>
}) => {
  console.log("PREFETCHING DRAWER")
  const { resourceId } = await params!

  const { dehydratedState } = await prefetch([
    learningResources.detail(Number(resourceId)),
  ])

  console.log("dehydratedState", dehydratedState)
  return (
    <Hydrate state={dehydratedState}>
      <LearningResourceDrawer />
    </Hydrate>
  )
}

export default Page
