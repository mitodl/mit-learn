import { renderHook, waitFor } from "@testing-library/react"
import { useQuery, type UseQueryOptions } from "@tanstack/react-query"
import { setupReactQueryTest } from "../../../hooks/test-utils"
import { setMockResponse, makeRequest } from "../../../test-utils"
import { factories, urls } from "../../test-utils"
import {
  analyticsContractQueries,
  analyticsOrganizationQueries,
} from "./queries"

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

describe("analyticsOrganizationQueries", () => {
  test.each([
    {
      name: "contractUtilization",
      query: () =>
        erase(analyticsOrganizationQueries.contractUtilization(ORG_UUID)),
      url: urls.organizations.contractUtilization(ORG_UUID),
      response: factories.envelope([factories.contractUtilization()]),
    },
    {
      name: "enrollmentFunnel",
      query: () =>
        erase(analyticsOrganizationQueries.enrollmentFunnel(ORG_UUID)),
      url: urls.organizations.enrollmentFunnel(ORG_UUID),
      response: factories.envelope([factories.enrollmentCompletionFunnel()]),
    },
    {
      name: "engagementTrend",
      query: () =>
        erase(analyticsOrganizationQueries.engagementTrend(ORG_UUID)),
      url: urls.organizations.engagementTrend(ORG_UUID),
      response: factories.envelope([factories.monthlyEngagementTrend()]),
    },
    {
      name: "programFunnel",
      query: () => erase(analyticsOrganizationQueries.programFunnel(ORG_UUID)),
      url: urls.organizations.programFunnel(ORG_UUID),
      response: factories.envelope([factories.programFunnel()]),
    },
    {
      name: "contentEngagement",
      query: () =>
        erase(analyticsOrganizationQueries.contentEngagement(ORG_UUID)),
      url: urls.organizations.contentEngagement(ORG_UUID),
      response: factories.envelope([factories.contentEngagementDepth()]),
    },
  ])("$name requests its endpoint and returns the envelope", async (spec) => {
    setMockResponse.get(spec.url, spec.response)
    const { wrapper } = setupReactQueryTest()

    const { result } = renderHook(() => useQuery(spec.query()), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(spec.response)
    expect(makeRequest).toHaveBeenCalledWith(
      expect.objectContaining({ method: "get", url: spec.url }),
    )
  })

  test("paging params reach the request and change the query key", async () => {
    const page = { limit: 200, offset: 0 }
    const url = urls.organizations.contractUtilization(ORG_UUID, page)
    const response = factories.envelope([factories.contractUtilization()])
    setMockResponse.get(url, response)
    const { wrapper } = setupReactQueryTest()

    const { result } = renderHook(
      () =>
        useQuery(
          analyticsOrganizationQueries.contractUtilization(ORG_UUID, page),
        ),
      { wrapper },
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(makeRequest).toHaveBeenCalledWith(
      expect.objectContaining({ method: "get", url }),
    )
    expect(
      analyticsOrganizationQueries.contractUtilization(ORG_UUID, page).queryKey,
    ).not.toEqual(
      analyticsOrganizationQueries.contractUtilization(ORG_UUID).queryKey,
    )
  })

  test("query keys are namespaced per org so one org cannot read another's cache", () => {
    const [namespace, resource, orgId] =
      analyticsOrganizationQueries.contractUtilization(ORG_UUID).queryKey
    expect([namespace, resource, orgId]).toEqual([
      "analytics",
      "organizations",
      ORG_UUID,
    ])
    expect(
      analyticsOrganizationQueries.contractUtilization("other").queryKey,
    ).not.toEqual(
      analyticsOrganizationQueries.contractUtilization(ORG_UUID).queryKey,
    )
  })

  test("the org id is url-encoded rather than spliced into the path raw", () => {
    expect(urls.organizations.contractUtilization("a/b")).toContain("a%2Fb")
  })
})

const CONTRACT_ID = "101"

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
      name: "programFunnel",
      query: () =>
        erase(analyticsContractQueries.programFunnel(ORG_UUID, CONTRACT_ID)),
      url: urls.contracts.programFunnel(ORG_UUID, CONTRACT_ID),
      response: factories.envelope([factories.programFunnel()]),
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
      analyticsContractQueries.contractUtilization(ORG_UUID, "202").queryKey,
    ).not.toEqual(key)
    // And a contract-scoped result never satisfies an org-scoped read.
    expect(key).not.toEqual(
      analyticsOrganizationQueries.contractUtilization(ORG_UUID).queryKey,
    )
  })

  test("the contract id is url-encoded rather than spliced into the path raw", () => {
    expect(urls.contracts.contractUtilization(ORG_UUID, "a/b")).toContain(
      "a%2Fb",
    )
  })
})
