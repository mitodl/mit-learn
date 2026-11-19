import React from "react"
import { renderWithProviders, screen } from "@/test-utils"
import { setMockResponse, urls } from "api/test-utils"
import { testimonials as factories } from "api/test-utils/factories"
import { testimonialsQueries } from "api/hooks/testimonials"
import type { Attestation } from "api/v0"
import { useFeatureFlag } from "@/common/useFeatureFlag"
import { useFeatureFlagsLoaded } from "@/common/useFeatureFlagsLoaded"
import { FEATURED_TESTIMONIAL_PARAMS } from "@/app-pages/SupportPage/queryParams"
import Page, { metadata } from "./page"

jest.mock("@/common/useFeatureFlagsLoaded", () => ({
  useFeatureFlagsLoaded: jest.fn(),
}))
jest.mock("@/common/useFeatureFlag")
// The route's server-side client, swapped for a browser one without retries.
// renderWithProviders uses the rest of the module, so it's kept.
jest.mock("@/app/getQueryClient", () => {
  const actual = jest.requireActual("@/app/getQueryClient")
  return {
    ...actual,
    getQueryClient: () => actual.makeBrowserQueryClient({ maxRetries: 0 }),
  }
})

const mockTestimonials = (results: Attestation[]) =>
  setMockResponse.get(urls.testimonials.list(FEATURED_TESTIMONIAL_PARAMS), {
    count: results.length,
    next: null,
    previous: null,
    results,
  })

const enableFlag = (enabled: boolean, loaded = true) => {
  jest.mocked(useFeatureFlagsLoaded).mockReturnValue(loaded)
  jest.mocked(useFeatureFlag).mockReturnValue(enabled)
}

describe("support page.tsx", () => {
  beforeEach(() => {
    mockTestimonials([])
  })

  test("renders the Support page when the flag is on", async () => {
    enableFlag(true)
    renderWithProviders(await Page())
    screen.getByRole("heading", { level: 1, name: "Support free education." })
  })

  test("renders nothing until the flags have loaded", async () => {
    enableFlag(false, false)
    renderWithProviders(await Page())
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument()
  })

  test("prefetches the featured testimonial on the server", async () => {
    const element = (await Page()) as React.ReactElement<{
      children: React.ReactElement<{
        state: { queries: { queryKey: unknown }[] }
      }>
    }>
    const hydration = element.props.children
    expect(hydration.props.state.queries.map((q) => q.queryKey)).toContainEqual(
      testimonialsQueries.list(FEATURED_TESTIMONIAL_PARAMS).queryKey,
    )
  })

  // With the data prefetched, the section renders in place on first paint:
  // no placeholder that later resizes or disappears.
  test("renders the prefetched testimonial without a placeholder", async () => {
    enableFlag(true)
    mockTestimonials([factories.testimonial({ quote: "Open doors." })])
    renderWithProviders(await Page())
    screen.getByText("“Open doors.”")
    expect(screen.queryByTestId("testimonial-skeleton")).not.toBeInTheDocument()
  })

  test("sets the title and description metadata", () => {
    expect(String(metadata.title)).toContain("Support free education")
    expect(metadata.description).toBe(
      "Help MIT keep high-quality educational resources available to learners everywhere.",
    )
  })
})
