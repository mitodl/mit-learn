import React from "react"
import { renderWithProviders, screen } from "@/test-utils"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { useFeatureFlagsLoaded } from "@/common/useFeatureFlagsLoaded"
import { ContactUsLauncher } from "@mitodl/smoot-design/contact-us"
import ContactUsLauncherGate from "./ContactUsLauncherGate"

jest.mock("@/common/useFeatureFlagsLoaded", () => ({
  useFeatureFlagsLoaded: jest.fn(),
}))
jest.mock("posthog-js/react")
jest.mock("@mitodl/smoot-design/contact-us", () => ({
  ContactUsLauncher: jest.fn(() => <div data-testid="launcher" />),
}))

const mockEnabled = jest.mocked(useFeatureFlagEnabled)
const mockLoaded = jest.mocked(useFeatureFlagsLoaded)
const mockLauncher = jest.mocked(ContactUsLauncher)

const ENDPOINT = "https://learn-ai.test/http/support_agent/"

describe("ContactUsLauncherGate", () => {
  const original = process.env.NEXT_PUBLIC_LEARN_AI_SUPPORT_ENDPOINT

  beforeEach(() => {
    process.env.NEXT_PUBLIC_LEARN_AI_SUPPORT_ENDPOINT = ENDPOINT
    mockLauncher.mockClear()
  })
  afterEach(() => {
    process.env.NEXT_PUBLIC_LEARN_AI_SUPPORT_ENDPOINT = original
  })

  test("renders the launcher and forwards the signed-in email", () => {
    mockLoaded.mockReturnValue(true)
    mockEnabled.mockReturnValue(true)
    renderWithProviders(<ContactUsLauncherGate />, {
      user: { is_authenticated: true, email: "learner@example.com" },
    })
    expect(screen.getByTestId("launcher")).toBeInTheDocument()
    expect(mockLauncher.mock.calls[0][0].settings.chat?.requestBody).toEqual({
      user_email: "learner@example.com",
    })
  })

  test("renders the launcher with no user_email for an anonymous learner", () => {
    mockLoaded.mockReturnValue(true)
    mockEnabled.mockReturnValue(true)
    renderWithProviders(<ContactUsLauncherGate />, {
      user: { is_authenticated: false },
    })
    expect(screen.getByTestId("launcher")).toBeInTheDocument()
    expect(
      mockLauncher.mock.calls[0][0].settings.chat?.requestBody,
    ).toBeUndefined()
  })

  test("renders nothing while flags have not loaded", () => {
    mockLoaded.mockReturnValue(false)
    mockEnabled.mockReturnValue(undefined)
    renderWithProviders(<ContactUsLauncherGate />, {
      user: { is_authenticated: false },
    })
    expect(screen.queryByTestId("launcher")).not.toBeInTheDocument()
  })

  test("renders nothing when the flag is disabled", () => {
    mockLoaded.mockReturnValue(true)
    mockEnabled.mockReturnValue(false)
    renderWithProviders(<ContactUsLauncherGate />, {
      user: { is_authenticated: false },
    })
    expect(screen.queryByTestId("launcher")).not.toBeInTheDocument()
  })

  test("renders nothing when the endpoint is unset", () => {
    delete process.env.NEXT_PUBLIC_LEARN_AI_SUPPORT_ENDPOINT
    mockLoaded.mockReturnValue(true)
    mockEnabled.mockReturnValue(true)
    renderWithProviders(<ContactUsLauncherGate />, {
      user: { is_authenticated: false },
    })
    expect(screen.queryByTestId("launcher")).not.toBeInTheDocument()
  })
})
