import React from "react"
import * as NiceModal from "@ebay/nice-modal-react"
import { HubspotForm, type HubspotFormProps } from "ol-components"
import { setMockResponse, urls, factories } from "api/test-utils"
import { renderWithProviders, screen, user, act, waitFor } from "@/test-utils"
import { StayUpdatedModal } from "./StayUpdatedModal"
import { STAY_UPDATED_FORM_ID } from "./test-utils/stayUpdated"

jest.mock("ol-components", () => ({
  ...jest.requireActual("ol-components"),
  HubspotForm: jest.fn(),
}))

const mockedHubspotForm = jest.mocked(HubspotForm)
const TEST_EMAIL = "user@test.edu"

const setupApis = () => {
  setMockResponse.get(
    urls.hubspot.details({ form_id: STAY_UPDATED_FORM_ID }),
    factories.hubspot.form({
      id: STAY_UPDATED_FORM_ID,
      name: "Stay Updated",
    }),
  )
  setMockResponse.post(urls.hubspot.submit(STAY_UPDATED_FORM_ID), {})
}

describe("StayUpdatedModal", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_STAY_UPDATED_HUBSPOT_FORM_ID = STAY_UPDATED_FORM_ID
    process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY = "test-site-key"

    mockedHubspotForm.mockImplementation((props: HubspotFormProps) => (
      <div>
        <button
          type="button"
          onClick={(e) =>
            props.onSubmit?.(
              { email: TEST_EMAIL },
              e as unknown as React.FormEvent<HTMLFormElement>,
              null,
            )
          }
        >
          Notify Me
        </button>
        {props.errorText ? <div role="alert">{props.errorText}</div> : null}
        {props.actions}
      </div>
    ))
  })

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_STAY_UPDATED_HUBSPOT_FORM_ID
    delete process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY
  })

  it("shows the form view when the modal is opened", async () => {
    setupApis()
    renderWithProviders(null)
    act(() => {
      NiceModal.show(StayUpdatedModal)
    })

    await screen.findByRole("dialog", { name: "Stay Updated" })
    expect(
      screen.getByRole("button", { name: "Notify Me" }),
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument()
    const lastHubspotFormProps = mockedHubspotForm.mock.calls.at(
      -1,
    )?.[0] as HubspotFormProps
    expect(lastHubspotFormProps.recaptchaEnabled).toBe(true)
    expect(lastHubspotFormProps.recaptchaSiteKey).toBe("test-site-key")
  })

  it("disables recaptcha when no frontend site key is configured", async () => {
    delete process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY
    setupApis()
    renderWithProviders(null)
    act(() => {
      NiceModal.show(StayUpdatedModal)
    })

    await screen.findByRole("dialog", { name: "Stay Updated" })
    const lastHubspotFormProps = mockedHubspotForm.mock.calls.at(
      -1,
    )?.[0] as HubspotFormProps
    expect(lastHubspotFormProps.recaptchaEnabled).toBe(false)
    expect(lastHubspotFormProps.recaptchaSiteKey).toBeUndefined()
  })

  it("shows the success view with the submitted email after form submission", async () => {
    setupApis()
    renderWithProviders(null)
    act(() => {
      NiceModal.show(StayUpdatedModal)
    })

    await screen.findByRole("dialog", { name: "Stay Updated" })
    await user.click(screen.getByRole("button", { name: "Notify Me" }))

    await screen.findByText(TEST_EMAIL)
    expect(screen.getByText(/we'll keep you updated at/i)).toBeInTheDocument()
  })

  it("replaces the form with the success view after submission", async () => {
    setupApis()
    renderWithProviders(null)
    act(() => {
      NiceModal.show(StayUpdatedModal)
    })

    await screen.findByRole("dialog", { name: "Stay Updated" })
    await user.click(screen.getByRole("button", { name: "Notify Me" }))

    await screen.findByRole("button", { name: "Done" })
    expect(
      screen.queryByRole("button", { name: "Notify Me" }),
    ).not.toBeInTheDocument()
  })

  it("closes the dialog when 'Done' is clicked in the success view", async () => {
    setupApis()
    renderWithProviders(null)
    act(() => {
      NiceModal.show(StayUpdatedModal)
    })

    await screen.findByRole("dialog", { name: "Stay Updated" })
    await user.click(screen.getByRole("button", { name: "Notify Me" }))

    const doneButton = await screen.findByRole("button", { name: "Done" })
    await user.click(doneButton)

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Stay Updated" }),
      ).not.toBeInTheDocument()
    })
  })

  it("closes the dialog when 'Cancel' is clicked in the form view", async () => {
    setupApis()
    renderWithProviders(null)
    act(() => {
      NiceModal.show(StayUpdatedModal)
    })

    await screen.findByRole("dialog", { name: "Stay Updated" })
    await user.click(screen.getByRole("button", { name: "Cancel" }))

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Stay Updated" }),
      ).not.toBeInTheDocument()
    })
  })

  it("shows error message when form submission fails", async () => {
    setMockResponse.get(
      urls.hubspot.details({ form_id: STAY_UPDATED_FORM_ID }),
      factories.hubspot.form({
        id: STAY_UPDATED_FORM_ID,
        name: "Stay Updated",
      }),
    )
    setMockResponse.post(
      urls.hubspot.submit(STAY_UPDATED_FORM_ID),
      "Server error",
      { code: 500 },
    )

    renderWithProviders(null)
    act(() => {
      NiceModal.show(StayUpdatedModal)
    })

    await screen.findByRole("dialog", { name: "Stay Updated" })
    await user.click(screen.getByRole("button", { name: "Notify Me" }))

    // Error message should be displayed
    expect(await screen.findByRole("alert")).toBeInTheDocument()
    // Form should still be visible (not replaced with success view)
    expect(
      screen.getByRole("button", { name: "Notify Me" }),
    ).toBeInTheDocument()
  })
})
