import React from "react"
import { HubspotForm, type HubspotFormProps } from "ol-components"
import { setMockResponse, urls, factories, makeRequest } from "api/test-utils"
import { faker } from "@faker-js/faker/locale/en"
import { renderWithProviders, screen, user, waitFor } from "@/test-utils"
import OrgLeadForm from "./OrgLeadForm"
import { getInTouch as copy } from "./copy"

/**
 * HubspotForm is stubbed with a minimal harness: what it renders from a HubSpot
 * definition is covered by its own suite in ol-components. What matters here is
 * the wiring around it — which branch renders, and what reaches the submit
 * endpoint.
 */
jest.mock("ol-components", () => ({
  ...jest.requireActual("ol-components"),
  HubspotForm: jest.fn(),
}))

const mockedHubspotForm = jest.mocked(HubspotForm)

const FORM_ID = faker.string.uuid()
const SUBMITTED_VALUES = { email: "lead@example.com", firstname: "Ada" }

const setupApis = () => {
  setMockResponse.get(
    urls.hubspot.details({ form_id: FORM_ID }),
    factories.hubspot.form({ id: FORM_ID, name: "Organizational Learning" }),
  )
  setMockResponse.post(urls.hubspot.submit(FORM_ID), {})
}

const selectAudience = (label: RegExp) =>
  user.click(screen.getByRole("radio", { name: label }))

const submitForm = () =>
  user.click(screen.getByRole("button", { name: "Submit stub" }))

describe("OrgLeadForm", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_ORG_LEARNING_HUBSPOT_FORM_ID = FORM_ID
    makeRequest.mockClear()
    mockedHubspotForm.mockImplementation((props: HubspotFormProps) => (
      <div data-testid="hubspot-form">
        <button
          type="button"
          onClick={(event) =>
            props.onSubmit?.(
              SUBMITTED_VALUES,
              event as unknown as React.FormEvent<HTMLFormElement>,
              null,
            )
          }
        >
          Submit stub
        </button>
        {props.errorText ? <div role="alert">{props.errorText}</div> : null}
      </div>
    ))
  })

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_ORG_LEARNING_HUBSPOT_FORM_ID
  })

  test("shows the lead form by default, so it is visible without interaction", () => {
    setupApis()
    renderWithProviders(<OrgLeadForm />)

    expect(screen.getByRole("radio", { name: /My organization/ })).toBeChecked()
    expect(screen.getByTestId("hubspot-form")).toBeInTheDocument()
  })

  test("replaces the form with B2C links when exploring for oneself", async () => {
    setupApis()
    renderWithProviders(<OrgLeadForm />)

    await selectAudience(/Myself/)

    // The whole point of the branch: an individual is not a sales lead, so the
    // form must be gone rather than merely hidden alongside the links.
    expect(screen.queryByTestId("hubspot-form")).not.toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: copy.individual.primaryCtaLabel }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: copy.individual.secondaryCtaLabel }),
    ).toBeInTheDocument()
  })

  test("restores the form when switching back to the organization path", async () => {
    setupApis()
    renderWithProviders(<OrgLeadForm />)

    await selectAudience(/Myself/)
    await selectAudience(/My organization/)

    expect(screen.getByTestId("hubspot-form")).toBeInTheDocument()
    expect(
      screen.queryByRole("link", { name: copy.individual.primaryCtaLabel }),
    ).not.toBeInTheDocument()
  })

  test("submits the field values to the form's submit endpoint", async () => {
    setupApis()
    renderWithProviders(<OrgLeadForm />)

    await submitForm()

    await waitFor(() => {
      expect(makeRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "post",
          url: urls.hubspot.submit(FORM_ID),
          body: expect.objectContaining({
            fields: [
              { name: "email", value: SUBMITTED_VALUES.email },
              { name: "firstname", value: SUBMITTED_VALUES.firstname },
            ],
          }),
        }),
      )
    })
  })

  test("does not send the audience choice to HubSpot", async () => {
    setupApis()
    renderWithProviders(<OrgLeadForm />)

    await submitForm()

    // The audience selector is local routing state, not lead data — sending it
    // would require a matching HubSpot property, which HubSpot silently drops
    // if absent.
    await waitFor(() =>
      expect(makeRequest).toHaveBeenCalledWith(
        expect.objectContaining({ method: "post" }),
      ),
    )
    const submit = makeRequest.mock.calls
      .map(([request]) => request as { method: string; body?: unknown })
      .findLast((request) => request.method === "post")
    const names = (submit?.body as { fields: { name: string }[] }).fields.map(
      (field) => field.name,
    )
    expect(names).toEqual(["email", "firstname"])
  })

  test("replaces the form with a confirmation after a successful submit", async () => {
    setupApis()
    renderWithProviders(<OrgLeadForm />)

    await submitForm()

    expect(await screen.findByText(copy.success.title)).toBeInTheDocument()
    // Terminal by design: inline, there is no dialog to dismiss back to a form.
    expect(screen.queryByTestId("hubspot-form")).not.toBeInTheDocument()
  })

  test("surfaces a submission failure instead of a false confirmation", async () => {
    setupApis()
    setMockResponse.post(urls.hubspot.submit(FORM_ID), {}, { code: 500 })
    renderWithProviders(<OrgLeadForm />)

    await submitForm()

    expect(await screen.findByRole("alert")).toBeInTheDocument()
    expect(screen.queryByText(copy.success.title)).not.toBeInTheDocument()
  })

  test("reports itself unavailable when no form id is configured", () => {
    delete process.env.NEXT_PUBLIC_ORG_LEARNING_HUBSPOT_FORM_ID
    renderWithProviders(<OrgLeadForm />)

    expect(screen.getByText(copy.unavailable)).toBeInTheDocument()
    expect(screen.queryByTestId("hubspot-form")).not.toBeInTheDocument()
    // The audience selector still works — only the form itself is unavailable.
    expect(screen.getByRole("radio", { name: /Myself/ })).toBeInTheDocument()
  })

  test("reports itself unavailable when the form definition fails to load", async () => {
    setMockResponse.get(
      urls.hubspot.details({ form_id: FORM_ID }),
      {},
      { code: 500 },
    )
    renderWithProviders(<OrgLeadForm />)

    expect(await screen.findByText(copy.unavailable)).toBeInTheDocument()
    expect(screen.queryByTestId("hubspot-form")).not.toBeInTheDocument()
    // The audience selector still works — only the form itself is unavailable.
    expect(screen.getByRole("radio", { name: /Myself/ })).toBeInTheDocument()
  })
})
