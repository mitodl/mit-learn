import { renderHook, waitFor } from "@testing-library/react"
import { useQuery, type UseQueryOptions } from "@tanstack/react-query"
import { setupReactQueryTest } from "../../../hooks/test-utils"
import { setMockResponse, makeRequest } from "../../../test-utils"
import { factories, urls } from "../../test-utils"
import { analyticsContractQueries } from "./queries"

const ORG_UUID = "3fa85f64-5717-4562-b3fc-2c963f66afa6"

/**
 * Each factory returns options for its own row type, so a `test.each` table of
 * them is a union that `useQuery` cannot resolve to a single overload. The
 * table only needs "does this options object request that URL", so erase the
 * row type here rather than splitting the table into five near-identical tests.
 */
type AnyQueryOptions = UseQueryOptions<
  unknown,
  Error,
  unknown,
  readonly unknown[]
>
const erase = (options: unknown) => options as AnyQueryOptions

const CONTRACT_ID = 101

describe("analyticsContractQueries", () => {
  test.each([
    {
      name: "contractUtilization",
      query: () =>
        erase(
          analyticsContractQueries.contractUtilization(ORG_UUID, CONTRACT_ID),
        ),
      url: urls.contracts.contractUtilization(ORG_UUID, CONTRACT_ID),
      response: factories.envelope([factories.contractUtilization()]),
    },
    {
      name: "enrollmentFunnel",
      query: () =>
        erase(analyticsContractQueries.enrollmentFunnel(ORG_UUID, CONTRACT_ID)),
      url: urls.contracts.enrollmentFunnel(ORG_UUID, CONTRACT_ID),
      response: factories.envelope([factories.enrollmentCompletionFunnel()]),
    },
    {
      name: "engagementTrend",
      query: () =>
        erase(analyticsContractQueries.engagementTrend(ORG_UUID, CONTRACT_ID)),
      url: urls.contracts.engagementTrend(ORG_UUID, CONTRACT_ID),
      response: factories.envelope([
        factories.contractMonthlyEngagementTrend(),
      ]),
    },
    {
      name: "contentEngagement",
      query: () =>
        erase(
          analyticsContractQueries.contentEngagement(ORG_UUID, CONTRACT_ID),
        ),
      url: urls.contracts.contentEngagement(ORG_UUID, CONTRACT_ID),
      response: factories.envelope([
        factories.contractContentEngagementDepth(),
      ]),
    },
    {
      name: "courseRuns",
      query: () =>
        erase(analyticsContractQueries.courseRuns(ORG_UUID, CONTRACT_ID)),
      url: urls.contracts.courseRuns(ORG_UUID, CONTRACT_ID),
      response: factories.envelope([factories.courseRun()]),
    },
    {
      name: "needsAttention",
      query: () =>
        erase(analyticsContractQueries.needsAttention(ORG_UUID, CONTRACT_ID)),
      url: urls.contracts.needsAttention(ORG_UUID, CONTRACT_ID),
      response: factories.envelope([factories.contractNeedsAttention()]),
    },
  ])(
    "$name requests the contract-nested path",
    async ({ query, url, response }) => {
      const { wrapper } = setupReactQueryTest()
      setMockResponse.get(url, response)

      const { result } = renderHook(() => useQuery(query()), { wrapper })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(makeRequest).toHaveBeenCalledWith(
        expect.objectContaining({ method: "get", url }),
      )
    },
  )

  test("contract keys nest under the org's, and differ per contract", () => {
    const key = analyticsContractQueries.contractUtilization(
      ORG_UUID,
      CONTRACT_ID,
    ).queryKey
    // The org prefix is intact, so invalidating an org drops its contracts too.
    expect(key.slice(0, 3)).toEqual(["analytics", "organizations", ORG_UUID])
    expect(key).toContain(CONTRACT_ID)
    expect(
      analyticsContractQueries.contractUtilization(ORG_UUID, 202).queryKey,
    ).not.toEqual(key)
  })

  test("the org id is url-encoded rather than spliced into the path raw", () => {
    expect(urls.contracts.contractUtilization("a/b", CONTRACT_ID)).toContain(
      "a%2Fb",
    )
  })
})
