import React from "react"
import { ReloadOnUserChange } from "./ReloadOnUserChange"
import { renderWithProviders, setupLocationMock, waitFor } from "@/test-utils"
import { setMockResponse, urls, factories } from "api/test-utils"
import { userQueries } from "api/hooks/user"

const makeUser = factories.user.user

describe("ReloadOnUserChange", () => {
  setupLocationMock()

  const user1 = makeUser()
  const user2 = makeUser()
  const anonUser = { is_authenticated: false }

  it.each([
    { fromUser: anonUser, toUser: anonUser, shouldReload: false },
    { fromUser: anonUser, toUser: user1, shouldReload: false },
    { fromUser: user1, toUser: user1, shouldReload: false },
    { fromUser: user1, toUser: user2, shouldReload: true },
    { fromUser: user1, toUser: anonUser, shouldReload: true },
  ])(
    "Does a full page reload when authenticated user changes",
    async ({ fromUser, toUser, shouldReload }) => {
      setMockResponse.get(urls.userMe.get(), fromUser)
      const { queryClient, view } = renderWithProviders(<ReloadOnUserChange />)

      await waitFor(() => {
        expect(queryClient.getQueryData(userQueries.me().queryKey)).toEqual(
          fromUser,
        )
      })

      setMockResponse.get(urls.userMe.get(), toUser)
      queryClient.invalidateQueries({ queryKey: userQueries.me().queryKey })

      await view.rerender(<ReloadOnUserChange />)

      await waitFor(() => {
        expect(queryClient.getQueryData(userQueries.me().queryKey)).toEqual(
          toUser,
        )
      })

      await waitFor(() => {
        const reloadCalls = shouldReload ? 1 : 0
        expect(window.location.reload).toHaveBeenCalledTimes(reloadCalls)
      })
    },
  )

  it("Does not reload when auth data does not change", async () => {
    const user = makeUser()
    setMockResponse.get(urls.userMe.get(), user)
    const { queryClient, view } = renderWithProviders(<ReloadOnUserChange />)

    await waitFor(() => {
      expect(queryClient.getQueryData(userQueries.me().queryKey)).toEqual(user)
    })

    queryClient.invalidateQueries({ queryKey: userQueries.me().queryKey })
    await view.rerender(<ReloadOnUserChange />)

    expect(window.location.reload).not.toHaveBeenCalled()
  })
})
