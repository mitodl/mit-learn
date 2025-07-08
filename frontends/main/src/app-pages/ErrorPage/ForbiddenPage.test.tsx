import React from "react"
import { renderWithProviders, screen, waitFor } from "../../test-utils"
import { HOME, login } from "@/common/urls"
import ForbiddenPage from "./ForbiddenPage"
import { setMockResponse, urls, factories } from "api/test-utils"
import { useUserMe } from "api/hooks/user"
import { redirect } from "next/navigation"

jest.mock("next/navigation", () => {
  const actual = jest.requireActual("next/navigation")
  return {
    ...actual,
    redirect: jest.fn(),
  }
})
const mockedRedirect = jest.mocked(redirect)

const makeUser = factories.user.user

test("The ForbiddenPage loads with Correct Title", async () => {
  setMockResponse.get(urls.userMe.get(), makeUser({ is_authenticated: true }))
  renderWithProviders(<ForbiddenPage />)
  await screen.findByRole("heading", {
    name: "You do not have permission to access this resource.",
  })
})

test("The ForbiddenPage loads with a link that directs to HomePage", async () => {
  setMockResponse.get(urls.userMe.get(), makeUser({ is_authenticated: true }))
  renderWithProviders(<ForbiddenPage />)
  const homeLink = await screen.findByRole("link", { name: "Home" })
  expect(homeLink).toHaveAttribute("href", HOME)
})

test("Fetches auth data afresh and redirects unauthenticated users to auth", async () => {
  const user = makeUser()
  setMockResponse.get(urls.userMe.get(), user)

  const FakeHeader = ({ children }: { children?: React.ReactNode }) => {
    const user = useUserMe()
    return (
      <div>
        {user.data?.first_name}
        {children}
      </div>
    )
  }
  const { view } = renderWithProviders(<FakeHeader />)

  await screen.findByText(user.first_name)

  setMockResponse.get(urls.userMe.get(), makeUser({ is_authenticated: false }))

  view.rerender(
    <FakeHeader>
      <ForbiddenPage />
    </FakeHeader>,
  )

  await waitFor(() => {
    expect(mockedRedirect).toHaveBeenCalledWith(login())
  })
})
