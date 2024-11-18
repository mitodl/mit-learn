import React from "react"
import { getMetadataAsync } from "@/common/metadata"
import SearchPage from "@/app-pages/SearchPage/SearchPage"
import type { PageParams } from "@/app/types"

export async function generateMetadata({ searchParams }: PageParams) {
  return await getMetadataAsync({
    title: "Search",
    searchParams,
  })
}

/**
 * The search page uses Next's `useSearchParams`. This requires either:
 *  1. wrap the <SearchPage /> in Suspense
 *  2. or force-dynamic.
 *
 * (1) caused a hydration error for authenticated users. We have not found
 * the root cause of the hydration error.
 *
 * (2) seems to work well.
 */
export const dynamic = "force-dynamic"

const Page: React.FC = () => {
  return <SearchPage />
}

export default Page
