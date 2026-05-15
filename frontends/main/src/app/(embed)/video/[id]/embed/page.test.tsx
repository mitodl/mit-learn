import { notFound } from "next/navigation"
import { factories, setMockResponse, urls } from "api/test-utils"
import type { VideoResource } from "api/v1"
import Page from "./page"

jest.mock("@/app/getQueryClient", () => {
  const { makeBrowserQueryClient } = jest.requireActual("@/app/getQueryClient")
  return {
    getQueryClient: () => makeBrowserQueryClient({ maxRetries: 0 }),
  }
})

jest.mock("@tanstack/react-query", () => ({
  ...jest.requireActual("@tanstack/react-query"),
  dehydrate: jest.fn().mockReturnValue({}),
}))

jest.mock("@/app-pages/VideoEmbedPage/VideoEmbedPage", () => ({
  __esModule: true,
  default: () => null,
}))

const mockNotFound = jest.mocked(notFound)

describe("video embed page.tsx server component", () => {
  beforeEach(() => {
    mockNotFound.mockImplementation(() => {
      throw new Error("NEXT_NOT_FOUND")
    })
  })

  test("calls notFound for a non-integer id", async () => {
    await expect(
      Page({ params: Promise.resolve({ id: "abc" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND")
    expect(notFound).toHaveBeenCalled()
  })

  test("calls notFound for id of zero", async () => {
    await expect(
      Page({ params: Promise.resolve({ id: "0" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND")
    expect(notFound).toHaveBeenCalled()
  })

  test("calls notFound for a negative id", async () => {
    await expect(
      Page({ params: Promise.resolve({ id: "-1" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND")
    expect(notFound).toHaveBeenCalled()
  })

  test("calls notFound when the resource is not a video", async () => {
    const course = factories.learningResources.course()
    setMockResponse.get(
      urls.learningResources.details({ id: course.id }),
      course,
    )

    await expect(
      Page({ params: Promise.resolve({ id: String(course.id) }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND")
    expect(notFound).toHaveBeenCalled()
  })

  test("does not call notFound for a video resource", async () => {
    const video = factories.learningResources.video() as VideoResource
    setMockResponse.get(urls.learningResources.details({ id: video.id }), video)

    await Page({ params: Promise.resolve({ id: String(video.id) }) })
    expect(notFound).not.toHaveBeenCalled()
  })
})
