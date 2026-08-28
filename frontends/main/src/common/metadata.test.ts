import type { AxiosError, AxiosResponse } from "axios"
import {
  safeGenerateMetadata,
  standardizeMetadata,
  getMetadataAsync,
} from "./metadata"
import { nextNavigationMocks } from "ol-test-utilities/mocks/nextNavigation"
import { setMockResponse, urls, factories } from "api/test-utils"

jest.mock("@/app/getQueryClient", () => {
  const { makeBrowserQueryClient } = jest.requireActual("@/app/getQueryClient")
  return { getQueryClient: () => makeBrowserQueryClient({ maxRetries: 0 }) }
})

describe("safeGenerateMetadata", () => {
  const mockMetadata = {
    title: "Test Title",
    description: "Test Description",
  }

  let consoleErrorSpy: jest.SpyInstance

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation()
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  test("Should call notFound() for errors with status 404", async () => {
    const error: Partial<AxiosError> = {
      response: { status: 404 } as AxiosResponse,
      message: "Not Found",
    }

    const fn = jest.fn().mockRejectedValue(error)

    await safeGenerateMetadata(fn)

    expect(nextNavigationMocks.notFound).toHaveBeenCalled()
    expect(consoleErrorSpy).not.toHaveBeenCalled()
  })

  test("Should return result on success", async () => {
    const fn = jest.fn().mockResolvedValue(mockMetadata)

    const result = await safeGenerateMetadata(fn)

    expect(result).toEqual(mockMetadata)
    expect(nextNavigationMocks.notFound).not.toHaveBeenCalled()
    expect(consoleErrorSpy).not.toHaveBeenCalled()
  })

  test("Should return standardized metadata for non-404 errors", async () => {
    const error = new Error("Something went wrong")
    const fn = jest.fn().mockRejectedValue(error)

    const result = await safeGenerateMetadata(fn)
    const standardizedMetadata = await standardizeMetadata()

    expect(result).toEqual(standardizedMetadata)
    expect(nextNavigationMocks.notFound).not.toHaveBeenCalled()
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Error fetching page metadata",
      error,
    )
  })
})

describe("standardizeMetadata", () => {
  test("converts an HTML description to plain text in all description fields", async () => {
    const meta = await standardizeMetadata({
      description: "<p>Daryl Morey &amp; Jessica Gelman</p>",
    })

    expect(meta.description).toBe("Daryl Morey & Jessica Gelman")
    expect(meta.openGraph?.description).toBe("Daryl Morey & Jessica Gelman")
    expect(meta.twitter?.description).toBe("Daryl Morey & Jessica Gelman")
  })
})

describe("getMetadataAsync drawer canonical", () => {
  test("canonicalizes the drawer to the resource's learn_url", async () => {
    // A resource with no page of its own: learn_url is this drawer URL, so the
    // canonical is self-referential.
    const resource = factories.learningResources.course({
      learn_url: "http://test.learn.odl.local:8062/search?resource=42",
    })
    setMockResponse.get(
      urls.learningResources.details({ id: resource.id }),
      resource,
    )
    const meta = await getMetadataAsync({
      searchParams: Promise.resolve({ resource: String(resource.id) }),
    })
    expect(meta.alternates?.canonical).toBe(resource.learn_url)
  })

  test("canonicalizes the drawer to a dedicated page where one exists", async () => {
    const resource = factories.learningResources.video({
      learn_url:
        "http://test.learn.odl.local:8062/video/6395/lecture-11?playlist=6384",
    })
    setMockResponse.get(
      urls.learningResources.details({ id: resource.id }),
      resource,
    )
    const meta = await getMetadataAsync({
      searchParams: Promise.resolve({ resource: String(resource.id) }),
    })
    expect(meta.alternates?.canonical).toBe(
      "http://test.learn.odl.local:8062/video/6395/lecture-11?playlist=6384",
    )
  })

  test.each([
    { description: "absent", learnUrl: undefined },
    { description: "blank", learnUrl: "" },
  ])(
    "falls back to the drawer canonical when learn_url is $description",
    async ({ learnUrl }) => {
      // A frontend deployed ahead of the backend sees no learn_url. Emitting no
      // canonical at all would be worse than the self-canonical it replaces.
      const resource = factories.learningResources.course()
      setMockResponse.get(urls.learningResources.details({ id: resource.id }), {
        ...resource,
        learn_url: learnUrl,
      })
      const meta = await getMetadataAsync({
        searchParams: Promise.resolve({ resource: String(resource.id) }),
      })
      expect(meta.alternates?.canonical).toContain(`resource=${resource.id}`)
    },
  )

  test("no canonical override when ?resource= is not a valid id", async () => {
    const meta = await getMetadataAsync({
      searchParams: Promise.resolve({ resource: "abc" }),
    })
    expect(meta.alternates?.canonical).toBeUndefined()
  })
})
