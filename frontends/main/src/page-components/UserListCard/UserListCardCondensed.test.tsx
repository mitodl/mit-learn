import React from "react"
import { screen } from "@testing-library/react"
import UserListCardCondensed from "./UserListCardCondensed"
import * as factories from "api/test-utils/factories"
import { userListView } from "@/common/urls"
import { renderWithProviders, user } from "@/test-utils"
import invariant from "tiny-invariant"

const userListFactory = factories.userLists

describe("UserListCard", () => {
  it("renders title", () => {
    const userList = userListFactory.userList()
    renderWithProviders(
      <UserListCardCondensed
        href={userListView(userList.id)}
        userList={userList}
      />,
    )
    screen.getByText(userList.title)
  })

  test("Clicking card navigates to href", async () => {
    const userList = userListFactory.userList()
    renderWithProviders(
      <UserListCardCondensed href="#test" userList={userList} />,
    )
    const link = screen.getByRole("link", { name: userList.title })
    expect(link).toHaveAttribute("href", "#test")
    invariant(link.parentElement)
    await user.click(link.parentElement)
    expect(window.location.hash).toBe("#test")
  })
})
