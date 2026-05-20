import React from "react"
import { QueryClientProvider } from "@tanstack/react-query"
import { renderHook, waitFor, setMockResponse } from "@/test-utils"
import { makeBrowserQueryClient } from "@/app/getQueryClient"
import { urls } from "api/mitxonline-test-utils"
import { setupProgramsAndCourses } from "../test-utils"
import { useContractDashboardData } from "./useContractDashboardData"

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = makeBrowserQueryClient({ maxRetries: 0 })
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe("useContractDashboardData", () => {
  beforeEach(() => {
    setMockResponse.get(urls.enrollment.enrollmentsListV3(), [])
    setMockResponse.get(urls.programEnrollments.enrollmentsListV3(), [])
  })

  test("omits standalone programs that are represented inside collections", async () => {
    const { orgX, programA, programB, programCollection } =
      setupProgramsAndCourses()

    programCollection.programs = [
      { id: programA.id, title: programA.title, order: 1 },
    ]
    setMockResponse.get(urls.programCollections.programCollectionsList(), {
      results: [programCollection],
    })

    const { result } = renderHook(
      () => useContractDashboardData(orgX, orgX.contracts[0]),
      { wrapper },
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.programs.map((row) => row.program.id)).toEqual([
      programB.id,
    ])
    expect(result.current.collections.map((row) => row.collection.id)).toEqual([
      programCollection.id,
    ])
  })

  test("builds collection first-course entries in collection program order", async () => {
    const { orgX, programA, programB, programCollection } =
      setupProgramsAndCourses()

    programCollection.programs = [
      { id: programA.id, title: programA.title, order: 2 },
      { id: programB.id, title: programB.title, order: 1 },
    ]
    setMockResponse.get(urls.programCollections.programCollectionsList(), {
      results: [programCollection],
    })

    const { result } = renderHook(
      () => useContractDashboardData(orgX, orgX.contracts[0]),
      { wrapper },
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    const collection = result.current.collections.find(
      (row) => row.collection.id === programCollection.id,
    )
    expect(collection).toBeDefined()
    expect(collection?.entries.map((entry) => entry.course.id)).toEqual([
      programB.courses[0],
      programA.courses[0],
    ])

    if (result.current.languageOptions.length > 0) {
      expect(result.current.selectedLanguageKey).toBe(
        String(result.current.languageOptions[0].value),
      )
    }
  })
})
