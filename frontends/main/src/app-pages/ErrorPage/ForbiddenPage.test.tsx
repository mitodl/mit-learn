import React from "react"
import { renderWithProviders, screen } from "../../test-utils"
import { HOME } from "@/common/urls"
import ForbiddenPage from "./ForbiddenPage"
import { setMockResponse, urls } from "api/test-utils"
import { Permission } from "api/hooks/user"

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

test("The ForbiddenPage loads with Correct Title", () => {
  setMockResponse.get(urls.userMe.get(), {
    [Permission.Authenticated]: true,
  })
  renderWithProviders(<ForbiddenPage />)
  screen.getByRole("heading", {
    name: "You do not have permission to access this resource.",
  })
})

test("The ForbiddenPage loads with a link that directs to HomePage", () => {
  setMockResponse.get(urls.userMe.get(), {
    [Permission.Authenticated]: true,
  })
  renderWithProviders(<ForbiddenPage />)
  const homeLink = screen.getByRole("link", { name: "Home" })
  expect(homeLink).toHaveAttribute("href", HOME)
})
