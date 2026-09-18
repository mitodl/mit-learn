import React from "react"
import NotificationPreferences from "./NotificationPreferences"
import { renderWithProviders, screen, within, user } from "@/test-utils"
import { setMockResponse, makeRequest } from "api/test-utils"
import { urls as mitxonlineUrls } from "api/mitxonline-test-utils"

/**
 * Mirrors a real GET /api/notification-preferences/ response: `non_editable` is
 * an object keyed by notification type, not a flat list of channels.
 */
const makePreferences = (overrides = {}) => ({
  show_preferences: true,
  show_email_preferences: true,
  data: {
    discussion: {
      enabled: true,
      non_editable: { new_discussion_post: ["web"] },
      notification_types: {
        new_discussion_post: {
          web: true,
          push: false,
          email: false,
          email_cadence: "Daily",
          info: "",
        },
        grouped_notification: {
          web: true,
          push: false,
          email: true,
          email_cadence: "Weekly",
          info: "Covers several activity types",
        },
      },
    },
    grading: {
      enabled: false,
      non_editable: {},
      notification_types: {
        ora_grade_assigned: {
          web: true,
          push: false,
          email: false,
          email_cadence: "Daily",
          info: "",
        },
      },
    },
  },
  ...overrides,
})

const setupApi = (
  responseBody: unknown = makePreferences(),
  { code = 200 }: { code?: number } = {},
) => {
  setMockResponse.get(
    mitxonlineUrls.notificationPreferences.get(),
    responseBody,
    {
      code,
    },
  )
  setMockResponse.put(mitxonlineUrls.notificationPreferences.put(), {})
}

const rowFor = async (notificationType: string) =>
  await screen.findByTestId(`notification-row-${notificationType}`)

describe("NotificationPreferences", () => {
  test("renders a group heading using the display label, not the API key", async () => {
    setupApi()
    renderWithProviders(<NotificationPreferences />)

    expect(
      await screen.findByRole("heading", { name: "Discussions" }),
    ).toBeInTheDocument()
  })

  test("renders one row per notification type, with our description copy", async () => {
    setupApi()
    renderWithProviders(<NotificationPreferences />)

    const row = await rowFor("new_discussion_post")
    expect(within(row).getByText("New discussion posts")).toBeInTheDocument()
    expect(
      within(row).getByText(
        "When someone starts a new discussion in your courses.",
      ),
    ).toBeInTheDocument()
  })

  test("falls back to the API's info for a type we do not know about", async () => {
    setupApi(
      makePreferences({
        data: {
          discussion: {
            enabled: true,
            non_editable: {},
            notification_types: {
              brand_new_type: {
                web: true,
                push: false,
                email: false,
                email_cadence: "Daily",
                info: "Straight from the LMS",
              },
            },
          },
        },
      }),
    )
    renderWithProviders(<NotificationPreferences />)

    const row = await rowFor("brand_new_type")
    expect(within(row).getByText("Straight from the LMS")).toBeInTheDocument()
  })

  test("skips groups the API reports as disabled", async () => {
    setupApi()
    renderWithProviders(<NotificationPreferences />)

    await screen.findByRole("heading", { name: "Discussions" })
    expect(
      screen.queryByRole("heading", { name: "Grading" }),
    ).not.toBeInTheDocument()
  })

  test("disables a channel the API marks non-editable for that type", async () => {
    setupApi()
    renderWithProviders(<NotificationPreferences />)

    const locked = await rowFor("new_discussion_post")
    expect(within(locked).getByLabelText("On site")).toBeDisabled()

    // non_editable is keyed by type, so the other row stays editable.
    const unlocked = await rowFor("grouped_notification")
    expect(within(unlocked).getByLabelText("On site")).toBeEnabled()
  })

  test("toggling a channel PUTs that single channel", async () => {
    setupApi()
    renderWithProviders(<NotificationPreferences />)

    const row = await rowFor("grouped_notification")
    await user.click(within(row).getByLabelText("On site"))

    expect(makeRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "put",
        url: mitxonlineUrls.notificationPreferences.put(),
        body: {
          notification_app: "discussion",
          notification_type: "grouped_notification",
          notification_channel: "web",
          value: false,
        },
      }),
    )
  })

  test("keeps the cadence control in place, disabled, while email is off", async () => {
    setupApi()
    renderWithProviders(<NotificationPreferences />)

    const emailOn = await rowFor("grouped_notification")
    expect(within(emailOn).getByRole("combobox")).toBeInTheDocument()
    expect(within(emailOn).getByRole("combobox")).not.toHaveAttribute(
      "aria-disabled",
      "true",
    )

    // Still rendered, showing the stored cadence, but not operable.
    const emailOff = await rowFor("new_discussion_post")
    const disabled = within(emailOff).getByRole("combobox")
    expect(disabled).toBeInTheDocument()
    expect(disabled).toHaveTextContent("Daily")
    expect(disabled).toHaveAttribute("aria-disabled", "true")
  })

  test("disables the cadence control when email is locked by the API", async () => {
    setupApi(
      makePreferences({
        data: {
          discussion: {
            enabled: true,
            non_editable: { locked_type: ["email"] },
            notification_types: {
              locked_type: {
                web: true,
                push: false,
                email: true,
                email_cadence: "Weekly",
                info: "",
              },
            },
          },
        },
      }),
    )
    renderWithProviders(<NotificationPreferences />)

    const row = await rowFor("locked_type")
    expect(within(row).getByLabelText("Email")).toBeDisabled()
    expect(within(row).getByRole("combobox")).toHaveAttribute(
      "aria-disabled",
      "true",
    )
  })

  test("changing the cadence PUTs email_cadence rather than a value", async () => {
    setupApi()
    renderWithProviders(<NotificationPreferences />)

    const row = await rowFor("grouped_notification")
    await user.click(within(row).getByRole("combobox"))
    await user.click(await screen.findByRole("option", { name: "Immediately" }))

    expect(makeRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "put",
        url: mitxonlineUrls.notificationPreferences.put(),
        body: {
          notification_app: "discussion",
          notification_type: "grouped_notification",
          notification_channel: "email_cadence",
          email_cadence: "Immediately",
        },
      }),
    )
  })

  test("hides email controls when the API turns email preferences off", async () => {
    setupApi(makePreferences({ show_email_preferences: false }))
    renderWithProviders(<NotificationPreferences />)

    const row = await rowFor("grouped_notification")
    expect(within(row).getByLabelText("On site")).toBeInTheDocument()
    expect(within(row).queryByLabelText("Email")).not.toBeInTheDocument()
    expect(within(row).queryByRole("combobox")).not.toBeInTheDocument()
  })

  test.each([
    {
      description: "the LMS has the feature switched off",
      response: makePreferences({ show_preferences: false }),
      code: 200,
      notice: "Notifications are not enabled for your courses.",
    },
    {
      description: "the learner has no course account yet",
      response: { detail: "no edx auth" },
      code: 409,
      notice:
        "Your course account is still being set up. Please check back shortly.",
    },
    {
      description: "the read fails",
      response: { detail: "boom" },
      code: 503,
      notice:
        "We could not load your notification settings. Please try again later.",
    },
    {
      description: "there is nothing to manage",
      response: makePreferences({ data: {} }),
      code: 200,
      notice: "You have no notification settings to manage yet.",
    },
  ])(
    "renders the section with a notice when $description",
    async ({ response, code, notice }) => {
      setupApi(response, { code })
      renderWithProviders(<NotificationPreferences />)

      expect(await screen.findByText(notice)).toBeInTheDocument()
      // The anchor must resolve even when there are no controls to show.
      expect(
        await screen.findByRole("heading", { name: "Notifications" }),
      ).toBeInTheDocument()
      expect(screen.queryByLabelText("On site")).not.toBeInTheDocument()
    },
  )
})
