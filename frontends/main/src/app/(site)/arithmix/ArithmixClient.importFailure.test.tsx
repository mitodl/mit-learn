import React from "react"
import { renderWithProviders, waitFor } from "@/test-utils"
import { notFound } from "next/navigation"
import { allowConsoleErrors } from "ol-test-utilities"
import ArithmixClient from "./ArithmixClient"

let getArithmixExport: () => unknown

jest.mock("mynumbers", () => ({
  __esModule: true,
  get Arithmix() {
    return getArithmixExport()
  },
}))

// Keep the feature flag enabled and loaded so the gate attempts to load the
// dynamic module.
jest.mock("posthog-js/react", () => ({
  useFeatureFlagEnabled: () => true,
}))
jest.mock("@/common/useFeatureFlagsLoaded", () => ({
  useFeatureFlagsLoaded: () => true,
}))

const mockNotFound = jest.mocked(notFound)

describe("ArithmixClient when mynumbers cannot be loaded", () => {
  beforeEach(() => {
    allowConsoleErrors()
  })

  test("renders a 404 when the dynamic import fails", async () => {
    getArithmixExport = () => {
      throw new Error("Failed to fetch dynamically imported module")
    }

    renderWithProviders(<ArithmixClient />)

    await waitFor(() => {
      expect(mockNotFound).toHaveBeenCalled()
    })
  })

  test("renders a 404 when mynumbers does not export Arithmix", async () => {
    getArithmixExport = () => undefined

    renderWithProviders(<ArithmixClient />)

    await waitFor(() => {
      expect(mockNotFound).toHaveBeenCalled()
    })
  })
})
