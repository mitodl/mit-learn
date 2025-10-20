import type { AxiosError, AxiosResponse } from "axios"
import { safeGenerateMetadata } from "./metadata"
import { nextNavigationMocks } from "ol-test-utilities/mocks/nextNavigation"

describe("safeGenerateMetadata", () => {
  const mockMetadata = {
    title: "Test Title",
    description: "Test Description",
  }

  const mockFallback = {
    title: "Fallback Title",
    description: "Fallback Description",
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

    await safeGenerateMetadata(fn, mockFallback)

    expect(nextNavigationMocks.notFound).toHaveBeenCalled()
    expect(consoleErrorSpy).not.toHaveBeenCalled()
  })

  test("Should return result on success", async () => {
    const fn = jest.fn().mockResolvedValue(mockMetadata)

    const result = await safeGenerateMetadata(fn, mockFallback)

    expect(result).toEqual(mockMetadata)
    expect(nextNavigationMocks.notFound).not.toHaveBeenCalled()
    expect(consoleErrorSpy).not.toHaveBeenCalled()
  })

  test("Should return fallback for non-404 errors", async () => {
    const error = new Error("Something went wrong")
    const fn = jest.fn().mockRejectedValue(error)

    const result = await safeGenerateMetadata(fn, mockFallback)

    expect(result).toEqual(mockFallback)
    expect(nextNavigationMocks.notFound).not.toHaveBeenCalled()
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Error fetching page metadata",
      error,
    )
  })

  test("Should call fallback function if provided", async () => {
    const error = new Error("Something went wrong")
    const fn = jest.fn().mockRejectedValue(error)
    const fallbackFn = jest.fn().mockResolvedValue(mockFallback)

    const result = await safeGenerateMetadata(fn, fallbackFn)

    expect(result).toEqual(mockFallback)
    expect(fallbackFn).toHaveBeenCalled()
    expect(nextNavigationMocks.notFound).not.toHaveBeenCalled()
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Error fetching page metadata",
      error,
    )
  })
})
