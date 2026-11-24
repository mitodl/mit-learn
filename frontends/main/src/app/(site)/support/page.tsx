import React from "react"
import type { Metadata } from "next"
import { HydrationBoundary, dehydrate } from "@tanstack/react-query"
import { testimonialsQueries } from "api/hooks/testimonials"
import { standardizeMetadata } from "@/common/metadata"
import { getQueryClient } from "@/app/getQueryClient"
import SupportPage from "@/app-pages/SupportPage/SupportPage"
import { FEATURED_TESTIMONIAL_PARAMS } from "@/app-pages/SupportPage/queryParams"
import SupportFlagGate from "./SupportFlagGate"

export const metadata: Metadata = standardizeMetadata({
  title: "Support open education",
  description:
    "Help keep MIT’s high-quality educational resources available to learners everywhere.",
})

const Page = async () => {
  const queryClient = getQueryClient()
  // Prefetched so the testimonial section renders in place on first paint,
  // instead of a placeholder that then resizes or disappears.
  await queryClient.prefetchQuery(
    testimonialsQueries.list(FEATURED_TESTIMONIAL_PARAMS),
  )

  return (
    <SupportFlagGate>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <SupportPage />
      </HydrationBoundary>
    </SupportFlagGate>
  )
}

export default Page
