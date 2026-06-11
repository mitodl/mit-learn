import React from "react"
import { renderWithProviders, waitFor } from "@/test-utils"
import { notFound } from "next/navigation"
import { allowConsoleErrors } from "ol-test-utilities"

jest.mock("posthog-js/react", () => ({
  useFeatureFlagEnabled: () => true,
}))
jest.mock("@/common/useFeatureFlagsLoaded", () => ({
  useFeatureFlagsLoaded: () => true,
}))

const mockNotFound = jest.mocked(notFound)

const renderWithFreshImport = async () => {
  const { default: ArithmixClient } = await import("./ArithmixClient")
  renderWithProviders(<ArithmixClient />)
}

describe("ArithmixClient when mynumbers cannot be loaded", () => {
  beforeEach(() => {
    jest.resetModules()
    allowConsoleErrors()
    mockNotFound.mockReset()
  })

  test("renders a 404 when the dynamic import fails", async () => {
    jest.doMock("mynumbers", () => {
      throw new Error("Failed to fetch dynamically imported module")
    })

    await renderWithFreshImport()

    await waitFor(() => {
      expect(mockNotFound).toHaveBeenCalled()
    })
  })

  test("renders a 404 when mynumbers does not export Arithmix", async () => {
    jest.doMock("mynumbers", () => ({ __esModule: true }))

    await renderWithFreshImport()

    await waitFor(() => {
      expect(mockNotFound).toHaveBeenCalled()
    })
  })
})
