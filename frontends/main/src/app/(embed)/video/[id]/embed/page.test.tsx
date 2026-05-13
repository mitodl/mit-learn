import { notFound } from "next/navigation"
import { factories } from "api/test-utils"
import type { VideoResource } from "api/v1"
import { getQueryClient } from "@/app/getQueryClient"
import Page from "./page"

jest.mock("@/app/getQueryClient", () => ({
  getQueryClient: jest.fn(),
}))

jest.mock("@tanstack/react-query", () => ({
  ...jest.requireActual("@tanstack/react-query"),
  dehydrate: jest.fn().mockReturnValue({}),
}))

jest.mock("@/app-pages/VideoEmbedPage/VideoEmbedPage", () => ({
  __esModule: true,
  default: () => null,
}))

const mockGetQueryClient = jest.mocked(getQueryClient)
const mockNotFound = jest.mocked(notFound)

describe("video embed page.tsx server component", () => {
  let mockFetchQueryOr404: jest.Mock

  beforeEach(() => {
    mockFetchQueryOr404 = jest.fn()
    mockGetQueryClient.mockReturnValue(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { fetchQueryOr404: mockFetchQueryOr404 } as any,
    )
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
    mockFetchQueryOr404.mockResolvedValue(course)

    await expect(
      Page({ params: Promise.resolve({ id: String(course.id) }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND")
    expect(notFound).toHaveBeenCalled()
  })

  test("calls notFound when the video has no supported sources", async () => {
    const video = factories.learningResources.video({
      video: {
        id: 1,
        streaming_url: null,
        duration: "PT5M",
        caption_urls: [],
        cover_image_url: null,
      },
      url: "https://example.com/not-youtube",
      content_files: [],
    }) as VideoResource
    mockFetchQueryOr404.mockResolvedValue(video)

    await expect(
      Page({ params: Promise.resolve({ id: String(video.id) }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND")
    expect(notFound).toHaveBeenCalled()
  })

  test("does not call notFound for a valid HLS video", async () => {
    const video = factories.learningResources.video({
      video: {
        id: 1,
        streaming_url: "https://cdn.example.com/video.m3u8",
        duration: "PT5M",
        caption_urls: [],
        cover_image_url: null,
      },
    }) as VideoResource
    mockFetchQueryOr404.mockResolvedValue(video)

    await Page({ params: Promise.resolve({ id: String(video.id) }) })
    expect(notFound).not.toHaveBeenCalled()
  })

  test("does not call notFound for a valid YouTube video via content_files", async () => {
    const video = factories.learningResources.video({
      video: {
        id: 1,
        streaming_url: null,
        duration: "PT5M",
        caption_urls: [],
        cover_image_url: null,
      },
      content_files: [
        factories.learningResources.contentFile({ youtube_id: "dQw4w9WgXcQ" }),
      ],
    }) as VideoResource
    mockFetchQueryOr404.mockResolvedValue(video)

    await Page({ params: Promise.resolve({ id: String(video.id) }) })
    expect(notFound).not.toHaveBeenCalled()
  })
})
