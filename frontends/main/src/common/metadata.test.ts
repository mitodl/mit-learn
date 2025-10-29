import type { AxiosError, AxiosResponse } from "axios"
import { safeGenerateMetadata, standardizeMetadata } from "./metadata"
import { nextNavigationMocks } from "ol-test-utilities/mocks/nextNavigation"

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
