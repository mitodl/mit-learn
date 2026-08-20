import React from "react"
import { SettingsContent } from "./SettingsContent"
import { renderWithProviders, screen, within, user } from "@/test-utils"
import { urls, setMockResponse, factories, makeRequest } from "api/test-utils"
import type { LearningResourcesUserSubscriptionApiLearningResourcesUserSubscriptionCheckListRequest as CheckSubscriptionRequest } from "api"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { FeatureFlags } from "@/common/feature_flags"
import { AccountAction, accountAction } from "@/common/urls"

jest.mock("posthog-js/react", () => ({
  ...jest.requireActual("posthog-js/react"),
  useFeatureFlagEnabled: jest.fn(),
}))
const mockedUseFeatureFlagEnabled = jest.mocked(useFeatureFlagEnabled)

const enableAccountManagement = (enabled: boolean) => {
  mockedUseFeatureFlagEnabled.mockImplementation((flag) =>
    flag === FeatureFlags.AccountManagement ? enabled : false,
  )
}

type SetupApisOptions = {
  isAuthenticated?: boolean
  isSubscribed?: boolean
  subscriptionRequest?: CheckSubscriptionRequest
  emailOptin?: boolean | null
  email?: string
  isSsoUser?: boolean
}
const setupApis = ({
  isAuthenticated = false,
  isSubscribed = false,
  subscriptionRequest = {},
  emailOptin = null,
  email = "learner@mit.edu",
  isSsoUser = false,
}: SetupApisOptions = {}) => {
  setMockResponse.get(urls.userMe.get(), {
    is_authenticated: isAuthenticated,
    email,
    is_sso_user: isSsoUser,
  })

  setMockResponse.get(urls.profileMe.get(), { email_optin: emailOptin })
  setMockResponse.patch(urls.profileMe.patch(), {})

  const subscribeResponse = isSubscribed
    ? factories.percolateQueries.percolateQueryList({ count: 5 }).results
    : factories.percolateQueries.percolateQueryList({ count: 0 }).results
  setMockResponse.get(
    `${urls.userSubscription.check(subscriptionRequest)}`,
    subscribeResponse,
  )
  const unsubscribeUrls = []
  for (const sub of subscribeResponse) {
    const unsubscribeUrl = urls.userSubscription.delete(sub?.id)
    unsubscribeUrls.push(unsubscribeUrl)
    setMockResponse.delete(unsubscribeUrl, sub)
  }

  return {
    unsubscribeUrls,
  }
}

describe("SettingsPage", () => {
  it("Renders user subscriptions in a list", async () => {
    setupApis({
      isAuthenticated: true,
      isSubscribed: true,
      subscriptionRequest: {},
    })
    renderWithProviders(<SettingsContent />)

    const followList = await screen.findByTestId("follow-list")
    expect(followList.children.length).toBe(5)
  })

  test("Clicking 'Unfollow' removes the subscription", async () => {
    const { unsubscribeUrls } = setupApis({
      isAuthenticated: true,
      isSubscribed: true,
      subscriptionRequest: {},
    })
    renderWithProviders(<SettingsContent />)

    const followList = await screen.findByTestId("follow-list")
    const unsubscribeLink = within(followList).getAllByText("Unfollow")[0]
    await user.click(unsubscribeLink)

    const unsubscribeButton = await screen.findByTestId("dialog-unfollow")
    await user.click(unsubscribeButton)
    expect(makeRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "delete",
        url: unsubscribeUrls[0],
      }),
    )
  })

  test("Clicking 'Unfollow All' removes all subscriptions", async () => {
    const { unsubscribeUrls } = setupApis({
      isAuthenticated: true,
      isSubscribed: true,
      subscriptionRequest: {},
    })
    renderWithProviders(<SettingsContent />)
    const unsubscribeLink = await screen.findByTestId("unfollow-all")
    await user.click(unsubscribeLink)

    const unsubscribeButton = await screen.findByTestId("dialog-unfollow")
    await user.click(unsubscribeButton)
    for (const unsubUrl of unsubscribeUrls) {
      expect(makeRequest).toHaveBeenCalledWith(
        expect.objectContaining({ method: "delete", url: unsubUrl }),
      )
    }
  })
  test("Unsubscribe from all is hidden if there are no subscriptions", async () => {
    setupApis({
      isAuthenticated: true,
      isSubscribed: false,
      subscriptionRequest: {},
    })
    renderWithProviders(<SettingsContent />)
    const unfollowButton = screen.queryByText("Unfollow All")
    expect(unfollowButton).not.toBeInTheDocument()
  })
})

describe("SettingsPage email preferences", () => {
  it("renders the email opt-in checkbox checked when email_optin is true", async () => {
    setupApis({ isAuthenticated: true, emailOptin: true })
    renderWithProviders(<SettingsContent />)
    const checkbox = await screen.findByRole("checkbox", {
      name: /receive emails from mit learn/i,
    })
    expect(checkbox).toBeChecked()
  })

  it("renders the email opt-in checkbox checked when email_optin is null (default)", async () => {
    setupApis({ isAuthenticated: true, emailOptin: null })
    renderWithProviders(<SettingsContent />)
    const checkbox = await screen.findByRole("checkbox", {
      name: /receive emails from mit learn/i,
    })
    expect(checkbox).toBeChecked()
  })

  it("renders the email opt-in checkbox unchecked when email_optin is false", async () => {
    setupApis({ isAuthenticated: true, emailOptin: false })
    renderWithProviders(<SettingsContent />)
    const checkbox = await screen.findByRole("checkbox", {
      name: /receive emails from mit learn/i,
    })
    expect(checkbox).not.toBeChecked()
  })

  it("PATCHes the profile when the email opt-in checkbox is toggled", async () => {
    setupApis({ isAuthenticated: true, emailOptin: true })
    renderWithProviders(<SettingsContent />)
    const checkbox = await screen.findByRole("checkbox", {
      name: /receive emails from mit learn/i,
    })
    await user.click(checkbox)
    expect(makeRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "patch",
        url: urls.profileMe.patch(),
      }),
    )
  })
})

describe("SettingsPage email & password", () => {
  const CHANGE_EMAIL = /change email/i
  const CHANGE_PASSWORD = /change password/i

  test("Links hand the user off to Django, which redirects to Keycloak", async () => {
    enableAccountManagement(true)
    setupApis({ isAuthenticated: true, email: "learner@mit.edu" })
    renderWithProviders(<SettingsContent />)

    const next = { pathname: "/dashboard/settings", searchParams: null }

    const changeEmail = await screen.findByRole("link", { name: CHANGE_EMAIL })
    expect(changeEmail).toHaveAttribute(
      "href",
      accountAction(AccountAction.UpdateEmail, next),
    )

    const changePassword = await screen.findByRole("link", {
      name: CHANGE_PASSWORD,
    })
    expect(changePassword).toHaveAttribute(
      "href",
      accountAction(AccountAction.UpdatePassword, next),
    )

    expect(await screen.findByText("learner@mit.edu")).toBeInTheDocument()
  })

  test("Section is hidden when the feature flag is off", async () => {
    enableAccountManagement(false)
    setupApis({ isAuthenticated: true })
    renderWithProviders(<SettingsContent />)

    await screen.findByRole("checkbox", {
      name: /receive emails from mit learn/i,
    })
    expect(
      screen.queryByRole("link", { name: CHANGE_EMAIL }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("link", { name: CHANGE_PASSWORD }),
    ).not.toBeInTheDocument()
  })

  test("Section is hidden for SSO users, whose credentials we don't own", async () => {
    enableAccountManagement(true)
    setupApis({ isAuthenticated: true, isSsoUser: true })
    renderWithProviders(<SettingsContent />)

    await screen.findByRole("checkbox", {
      name: /receive emails from mit learn/i,
    })
    expect(
      screen.queryByRole("link", { name: CHANGE_EMAIL }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("link", { name: CHANGE_PASSWORD }),
    ).not.toBeInTheDocument()
  })
})
