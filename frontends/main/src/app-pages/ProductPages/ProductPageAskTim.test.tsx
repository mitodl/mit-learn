import React from "react"
import { setMockResponse, urls, factories, makeRequest } from "api/test-utils"
import { waitFor } from "@testing-library/react"
import { renderWithProviders, screen, user } from "@/test-utils"
import {
  ProductPageAskTimButton,
  ProductPageAskTimSection,
} from "./ProductPageAskTim"
import { useFeatureFlagEnabled, usePostHog } from "posthog-js/react"
import { FeatureFlags } from "@/common/feature_flags"
import { PostHogEvents } from "@/common/constants"
import { RESOURCE_DRAWER_PARAMS } from "@/common/urls"
import { ResourceTypeEnum, type LearningResource } from "api"

jest.mock("posthog-js/react", () => ({
  ...jest.requireActual("posthog-js/react"),
  useFeatureFlagEnabled: jest.fn(),
  usePostHog: jest.fn(),
}))
const mockedUseFeatureFlagEnabled = jest.mocked(useFeatureFlagEnabled)
const mockCapture = jest.fn()
jest.mocked(usePostHog).mockReturnValue(
  // @ts-expect-error Not mocking all of posthog
  { capture: mockCapture },
)

const setupLearnResource = (
  resource: LearningResource = factories.learningResources.course({
    readable_id: "course-v1:MITx+TEST",
    resource_category: "Course",
  }),
) => {
  const listUrl = urls.learningResources.list({
    readable_id: [resource.readable_id],
    limit: 1,
  })
  setMockResponse.get(listUrl, {
    count: 1,
    next: null,
    previous: null,
    results: [resource],
  })
  return { resource, listUrl }
}

describe("ProductPageAskTimButton", () => {
  test("renders Ask TIM link for a course resource", () => {
    delete window.__ENV
    const resource = factories.learningResources.course({
      resource_category: "Course",
    })

    renderWithProviders(<ProductPageAskTimButton resource={resource} />)

    expect(
      screen.getByRole("link", { name: /ask tim about this course/i }),
    ).toBeInTheDocument()
  })
})

describe("ProductPageAskTimSection", () => {
  beforeEach(() => {
    delete window.__ENV
    process.env.NEXT_PUBLIC_LEARN_AI_SYLLABUS_ENDPOINT =
      "https://example.com/syllabus"
    mockedUseFeatureFlagEnabled.mockImplementation((flag) => {
      if (flag === FeatureFlags.LrDrawerChatbot) return true
      if (flag === FeatureFlags.PrDrawerChatbot) return true
      return false
    })
  })

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_LEARN_AI_SYLLABUS_ENDPOINT
  })

  test("renders Ask TIM button when Learn resource exists and flag enabled", async () => {
    const { resource } = setupLearnResource()

    renderWithProviders(
      <ProductPageAskTimSection
        readableId={resource.readable_id}
        resourceType="course"
      />,
    )

    await waitFor(() =>
      expect(makeRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "get",
          url: expect.stringContaining("readable_id=course-v1%3AMITx%2BTEST"),
        }),
      ),
    )
    await waitFor(() =>
      expect(makeRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "get",
          url: expect.stringContaining("limit=1"),
        }),
      ),
    )

    expect(
      await screen.findByRole("link", { name: /ask tim about this course/i }),
    ).toBeInTheDocument()
  })

  test("hides button and skips fetch when the flag is off (env still on)", async () => {
    // beforeEach leaves NEXT_PUBLIC_LEARN_AI_SYLLABUS_ENDPOINT set, so this
    // isolates the per-type flag as the gate that suppresses the network call.
    mockedUseFeatureFlagEnabled.mockReturnValue(false)
    const { resource } = setupLearnResource()

    renderWithProviders(
      <ProductPageAskTimSection
        readableId={resource.readable_id}
        resourceType="course"
      />,
    )

    expect(
      screen.queryByRole("link", { name: /ask tim/i }),
    ).not.toBeInTheDocument()
    expect(makeRequest).not.toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringContaining("readable_id="),
      }),
    )
  })

  test("renders Ask TIM button for a program resource", async () => {
    const program = factories.learningResources.program({
      readable_id: "program-v1:MITx+PROG",
      resource_category: "Program",
    })
    setupLearnResource(program)

    renderWithProviders(
      <ProductPageAskTimSection
        readableId={program.readable_id}
        resourceType="program"
      />,
    )

    expect(
      await screen.findByRole("link", {
        name: /ask tim about this program/i,
      }),
    ).toBeInTheDocument()
  })

  test("labels by resource_category for a program shown as a course", async () => {
    // A "program as course" page renders a program (resource_type=program) with
    // resource_category overridden to "Course"; resourceType stays "program".
    const programAsCourse = factories.learningResources.program({
      readable_id: "program-v1:MITx+PAC",
      resource_category: "Course",
    })
    setupLearnResource(programAsCourse)

    renderWithProviders(
      <ProductPageAskTimSection
        readableId={programAsCourse.readable_id}
        resourceType="program"
      />,
    )

    expect(
      await screen.findByRole("link", {
        name: /ask tim about this course/i,
      }),
    ).toBeInTheDocument()
  })

  test("hides button when Learn resource is not found", () => {
    setMockResponse.get(
      urls.learningResources.list({
        readable_id: ["missing-course"],
        limit: 1,
      }),
      { count: 0, next: null, previous: null, results: [] },
    )

    renderWithProviders(
      <ProductPageAskTimSection
        readableId="missing-course"
        resourceType="course"
      />,
    )

    expect(
      screen.queryByRole("link", { name: /ask tim/i }),
    ).not.toBeInTheDocument()
  })

  test("does not fetch the resource when chat is disabled", async () => {
    delete process.env.NEXT_PUBLIC_LEARN_AI_SYLLABUS_ENDPOINT
    mockedUseFeatureFlagEnabled.mockReturnValue(false)
    const { resource } = setupLearnResource()

    renderWithProviders(
      <ProductPageAskTimSection
        readableId={resource.readable_id}
        resourceType="course"
      />,
    )

    expect(makeRequest).not.toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringContaining("readable_id="),
      }),
    )
    expect(
      screen.queryByRole("link", { name: /ask tim/i }),
    ).not.toBeInTheDocument()
  })

  test("clicking Ask TIM sets syllabus_only query param and fires PostHog", async () => {
    process.env.NEXT_PUBLIC_POSTHOG_API_KEY = "test-key"
    mockCapture.mockClear()
    const { resource } = setupLearnResource()

    const { location } = renderWithProviders(
      <ProductPageAskTimSection
        readableId={resource.readable_id}
        resourceType="course"
      />,
    )

    const link = await screen.findByRole("link", { name: /ask tim/i })
    await user.click(link)

    expect(
      location.current.searchParams.get(RESOURCE_DRAWER_PARAMS.resource),
    ).toBe(String(resource.id))
    // syllabus_only alone is enough; the drawer treats it as chat-open.
    expect(
      location.current.searchParams.has(RESOURCE_DRAWER_PARAMS.syllabusOnly),
    ).toBe(true)
    expect(
      location.current.searchParams.has(RESOURCE_DRAWER_PARAMS.syllabus),
    ).toBe(false)
    expect(mockCapture).toHaveBeenCalledWith(
      PostHogEvents.AskTimClicked,
      expect.objectContaining({
        type: "syllabus_bot",
        resourceId: resource.id,
        readableId: resource.readable_id,
        resourceType: ResourceTypeEnum.Course,
      }),
    )
    delete process.env.NEXT_PUBLIC_POSTHOG_API_KEY
  })
})
