import { renderHook, waitFor } from "@testing-library/react"
import type { UseQueryResult } from "@tanstack/react-query"

import { setupReactQueryTest } from "../test-utils"
import { setMockResponse, urls, makeRequest } from "../../test-utils"
import {
  useHubspotFormDetail,
  useHubspotFormSubmit,
  type HubspotFormDetailResponse,
} from "./index"

type HubspotSubmitBody = {
  fields: Array<{ name: string; value: string | boolean | string[] | null }>
  page_uri?: string
  hutk?: string
  page_name?: string
  submitted_at?: number
}

const isHubspotSubmitBody = (value: unknown): value is HubspotSubmitBody => {
  if (!value || typeof value !== "object") return false
  return Array.isArray((value as HubspotSubmitBody).fields)
}

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
    const pageUri = "https://learn.mit.edu/programs/test-program/"

    setMockResponse.post(url, response, {
      code: 200,
    })

    const { wrapper } = setupReactQueryTest()
    const { result } = renderHook(useHubspotFormSubmit, { wrapper })

    result.current.mutate({ formId, fields, pageUri })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(makeRequest).toHaveBeenCalledWith(
      "post",
      url,
      expect.objectContaining({
        fields,
        page_uri: pageUri,
      }),
    )
    expect(result.current.data).toEqual(response)
  })

  it("Falls back to the current browser location and includes auto-captured context", async () => {
    const formId = "form-123"
    const fields = [{ name: "email", value: "test@example.com" }]
    const url = urls.hubspot.submit(formId)
    const response = { status: "submitted" }

    window.history.pushState({}, "", "/programs/test-program")

    setMockResponse.post(url, response, {
      code: 200,
    })

    const { wrapper } = setupReactQueryTest()
    const { result } = renderHook(useHubspotFormSubmit, { wrapper })

    result.current.mutate({ formId, fields })

    await waitFor(() => {
      expect(makeRequest).toHaveBeenCalledWith(
        "post",
        url,
        expect.objectContaining({
          fields,
          page_uri: "http://localhost/programs/test-program",
        }),
      )
    })
    expect(result.current.data).toEqual(response)
  })

  it("Auto-captures all context properties", async () => {
    const formId = "form-123"
    const fields = [{ name: "email", value: "test@example.com" }]
    const url = urls.hubspot.submit(formId)
    const response = { status: "submitted" }

    // Set up test documents and cookies
    Object.defineProperty(document, "title", {
      value: "MIT Learn - Test Program",
      writable: true,
    })
    document.cookie = "hubspotutk=abc123def456; Path=/"

    window.history.pushState({}, "", "/programs/test-program")
    const now = Date.now()

    setMockResponse.post(url, response, {
      code: 200,
    })

    const { wrapper } = setupReactQueryTest()
    const { result } = renderHook(useHubspotFormSubmit, { wrapper })

    result.current.mutate({ formId, fields })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    // Verify context properties were captured
    const call = makeRequest.mock.calls.find(
      (args) => args[0] === "post" && args[1] === url,
    )
    expect(call).toBeDefined()
    const requestBody = call![2]

    const body = requestBody
    if (!isHubspotSubmitBody(body)) {
      throw new Error("Request body does not match expected shape")
    }

    expect(body.page_uri).toBe("http://localhost/programs/test-program")
    expect(body.hutk).toBe("abc123def456") // pragma: allowlist secret
    expect(body.page_name).toBe("MIT Learn - Test Program")
    expect(body.submitted_at).toBeGreaterThanOrEqual(now)
    expect(body.submitted_at).toBeLessThanOrEqual(Date.now())
  })

  it("Creates hubspotutk cookie when absent and uses it as hutk", async () => {
    const formId = "form-123"
    const fields = [{ name: "email", value: "test@example.com" }]
    const url = urls.hubspot.submit(formId)
    const response = { status: "submitted" }

    // Ensure the cookie is absent before this test
    document.cookie = "hubspotutk=; max-age=0; path=/"

    setMockResponse.post(url, response, { code: 200 })

    const { wrapper } = setupReactQueryTest()
    const { result } = renderHook(useHubspotFormSubmit, { wrapper })

    result.current.mutate({ formId, fields })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const call = makeRequest.mock.calls.find(
      (args) => args[0] === "post" && args[1] === url,
    )
    const requestBody = call![2]

    if (!isHubspotSubmitBody(requestBody)) {
      throw new Error("Request body does not match expected shape")
    }

    // A 32-char hex utk should have been generated and sent
    expect(typeof requestBody.hutk).toBe("string")
    expect(requestBody.hutk).toHaveLength(32)
    expect(requestBody.hutk).toMatch(/^[0-9a-f]{32}$/)

    // The generated value should also be stored in the cookie
    const storedUtk = document.cookie
      .split("; ")
      .find((row) => row.startsWith("hubspotutk="))
      ?.split("=")[1]
    expect(storedUtk).toBe(requestBody.hutk)
  })

  it("Allows explicit context properties to override auto-captured ones", async () => {
    const formId = "form-123"
    const fields = [{ name: "email", value: "test@example.com" }]
    const url = urls.hubspot.submit(formId)
    const response = { status: "submitted" }
    const customPageUri = "https://learn.mit.edu/custom-page/"
    const customPageTitle = "Custom Title"

    setMockResponse.post(url, response, {
      code: 200,
    })

    const { wrapper } = setupReactQueryTest()
    const { result } = renderHook(useHubspotFormSubmit, { wrapper })

    result.current.mutate({
      formId,
      fields,
      pageUri: customPageUri,
      pageTitle: customPageTitle,
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const call = makeRequest.mock.calls.find(
      (args) => args[0] === "post" && args[1] === url,
    )
    const requestBody = call![2]

    if (!isHubspotSubmitBody(requestBody)) {
      throw new Error("Request body does not match expected shape")
    }

    // Explicit values should be used as-is
    expect(requestBody.page_uri).toBe(customPageUri)
    expect(requestBody.page_name).toBe(customPageTitle)
  })
})
