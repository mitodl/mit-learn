import React from "react"
import { renderWithProviders, setMockResponse } from "@/test-utils"
import { urls } from "api/test-utils"
import { urls as b2bUrls } from "api/mitxonline-test-utils"
import * as commonUrls from "@/common/urls"
import { Permission } from "api/hooks/user"
import B2BAttachPage from "./B2BAttachPage"

const oldWindowLocation = window.location

beforeAll(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (window as any).location

  window.location = Object.defineProperties({} as Location, {
    ...Object.getOwnPropertyDescriptors(oldWindowLocation),
    assign: {
      configurable: true,
      value: jest.fn(),
    },
  })
})

afterAll(() => {
  window.location = oldWindowLocation
})

describe("B2BAttachPage", () => {
  test("Renders when logged in", async () => {
    setMockResponse.get(urls.userMe.get(), {
      [Permission.Authenticated]: true,
    })

    setMockResponse.post(b2bUrls.b2bAttach.b2bAttachView("test-code"), [])

    renderWithProviders(<B2BAttachPage code="test-code" />, {
      url: commonUrls.B2B_ATTACH_VIEW,
    })
  })
})
