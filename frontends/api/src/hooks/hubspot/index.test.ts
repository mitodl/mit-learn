import { renderHook, waitFor } from "@testing-library/react"
import type { UseQueryResult } from "@tanstack/react-query"

import { setupReactQueryTest } from "../test-utils"
import { setMockResponse, urls, makeRequest } from "../../test-utils"
import {
  useHubspotFormDetail,
  useHubspotFormSubmit,
  type HubspotFormDetailResponse,
} from "./index"

const formFactory = (
  overrides: Partial<HubspotFormDetailResponse> = {},
): HubspotFormDetailResponse => ({
  id: "form-123",
  name: "HubSpot Test Form",
  form_type: "hubspot",
  created_at: "2026-03-30T00:00:00Z",
  updated_at: "2026-03-30T00:00:00Z",
  archived: false,
  field_groups: [],
  ...overrides,
})

const assertApiCalled = async (
  result: { current: UseQueryResult<HubspotFormDetailResponse | undefined> },
  url: string,
  method: string,
  data: unknown,
) => {
  await waitFor(() => expect(result.current.isLoading).toBe(false))
  expect(
    makeRequest.mock.calls.some((args) => {
      return args[0].toUpperCase() === method && args[1] === url
    }),
  ).toBe(true)
  expect(result.current.data).toEqual(data)
}

describe("useHubspotFormDetail", () => {
  it("Calls the correct API", async () => {
    const data = formFactory()
    const params = { form_id: data.id ?? "" }
    const url = urls.hubspot.details(params)

    const { wrapper } = setupReactQueryTest()
    setMockResponse.get(url, data)
    const useTestHook = () => useHubspotFormDetail(params)
    const { result } = renderHook(useTestHook, { wrapper })

    await assertApiCalled(result, url, "GET", data)
  })
})

describe("useHubspotFormSubmit", () => {
  it("Calls the correct API", async () => {
    const formId = "form-123"
    const fields = [{ name: "email", value: "test@example.com" }]
    const url = urls.hubspot.submit(formId)
    const response = { status: "submitted" }

    setMockResponse.post(url, response, {
      code: 200,
      requestBody: { fields },
    })

    const { wrapper } = setupReactQueryTest()
    const { result } = renderHook(useHubspotFormSubmit, { wrapper })

    result.current.mutate({ formId, fields })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(makeRequest).toHaveBeenCalledWith("post", url, { fields })
    expect(result.current.data).toEqual(response)
  })
})
