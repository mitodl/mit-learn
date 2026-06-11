import React from "react"
import { renderWithProviders, waitFor } from "@/test-utils"
import { notFound } from "next/navigation"
import { allowConsoleErrors } from "ol-test-utilities"

/**
 * The mynumbers package is a git-sourced dependency that is dynamically
 * imported client-side. These tests cover the failure paths where the package
 * cannot be loaded or does not export the expected shape, ensuring the gate
 * renders a 404 (notFound) rather than silently rendering nothing or surfacing
 * an unhandled error.
 *
 * Each test resets the module registry and re-imports ExplainerClient so that
 * the `next/dynamic` loadable picks up a fresh `mynumbers` mock (the loadable
 * caches its result, so a fresh module graph is required per scenario).
 */

// Keep the feature flag enabled and loaded so the gate renders the page and we
// actually exercise the dynamic import.
jest.mock("posthog-js/react", () => ({
  useFeatureFlagEnabled: () => true,
}))
jest.mock("@/common/useFeatureFlagsLoaded", () => ({
  useFeatureFlagsLoaded: () => true,
}))

const mockNotFound = jest.mocked(notFound)

const renderWithFreshImport = async () => {
  const { default: ExplainerClient } = await import("./ExplainerClient")
  renderWithProviders(<ExplainerClient />)
}

describe("ExplainerClient when mynumbers cannot be loaded", () => {
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

  test("renders a 404 when mynumbers does not export ExplainerPage", async () => {
    jest.doMock("mynumbers", () => ({ __esModule: true }))

    await renderWithFreshImport()

    await waitFor(() => {
      expect(mockNotFound).toHaveBeenCalled()
    })
  })
})
