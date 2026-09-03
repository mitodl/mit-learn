import React from "react"
import { HubspotForm, type HubspotFormProps } from "ol-components"
import { setMockResponse, urls, factories, makeRequest } from "api/test-utils"
import { faker } from "@faker-js/faker/locale/en"
import { renderWithProviders, screen, user, waitFor, act } from "@/test-utils"
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

/**
 * Each radio's accessible name is its label plus its description, so these match
 * on the label alone. Built from the copy rather than written out, so a
 * capitalization pass on the labels cannot silently unmatch every query here.
 */
const AUDIENCE = {
  organization: new RegExp(copy.audience.organizationLabel),
  individual: new RegExp(copy.audience.individualLabel),
}

const selectAudience = (label: RegExp) =>
  user.click(screen.getByRole("radio", { name: label }))

/** Awaits the stub: the form only mounts once its definition has loaded. */
const submitForm = async () =>
  user.click(await screen.findByRole("button", { name: "Submit stub" }))

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
        {/* Passed in by OrgLeadForm, so it is under test rather than stubbed. */}
        {props.submitButton}
        {props.errorText ? <div role="alert">{props.errorText}</div> : null}
      </div>
    ))
  })

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_ORG_LEARNING_HUBSPOT_FORM_ID
  })

  test("shows the lead form by default, so it is visible without interaction", async () => {
    setupApis()
    renderWithProviders(<OrgLeadForm />)

    expect(
      screen.getByRole("radio", { name: AUDIENCE.organization }),
    ).toBeChecked()
    expect(await screen.findByTestId("hubspot-form")).toBeInTheDocument()
  })

  test("says the form is loading rather than leaving the card empty", async () => {
    const pending = Promise.withResolvers<unknown>()
    setMockResponse.get(
      urls.hubspot.details({ form_id: FORM_ID }),
      pending.promise,
    )
    renderWithProviders(<OrgLeadForm />)

    // HubspotForm renders nothing without a definition, so without this branch
    // the card body is blank for the whole request.
    const [announced, visible] = screen.getAllByText(copy.loading)
    expect(announced).toHaveAttribute("aria-live", "polite")
    // Announced once: the visible copy is hidden from assistive tech so the
    // live region is not doubled up by it.
    expect(visible).toHaveAttribute("aria-hidden", "true")
    expect(screen.queryByTestId("hubspot-form")).not.toBeInTheDocument()
  })

  test("replaces the form with B2C links when exploring for oneself", async () => {
    setupApis()
    renderWithProviders(<OrgLeadForm />)

    await selectAudience(AUDIENCE.individual)

    // The whole point of the branch: an individual is not a sales lead, so the
    // form must be gone rather than merely hidden alongside the links.
    expect(screen.queryByTestId("hubspot-form")).not.toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: copy.individual.ctaLabel }),
    ).toBeInTheDocument()
  })

  test("restores the form when switching back to the organization path", async () => {
    setupApis()
    renderWithProviders(<OrgLeadForm />)

    await selectAudience(AUDIENCE.individual)
    await selectAudience(AUDIENCE.organization)

    expect(screen.getByTestId("hubspot-form")).toBeInTheDocument()
    expect(
      screen.queryByRole("link", { name: copy.individual.ctaLabel }),
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

  test("moves focus to the confirmation, which the submit button's removal would otherwise drop", async () => {
    setupApis()
    renderWithProviders(<OrgLeadForm />)

    await submitForm()
    const title = await screen.findByText(copy.success.title)

    // Focus lands on the container so both lines are announced, and so it does
    // not fall to document.body when the form unmounts.
    const confirmation = title.parentElement
    expect(confirmation).toHaveFocus()
    expect(confirmation).toHaveTextContent(copy.success.body)
  })

  test("marks the submit button busy while the submission is in flight", async () => {
    setupApis()
    const pending = Promise.withResolvers<Record<string, never>>()
    setMockResponse.post(urls.hubspot.submit(FORM_ID), pending.promise)
    renderWithProviders(<OrgLeadForm />)

    const submit = await screen.findByRole("button", {
      name: copy.submitLabel,
    })
    expect(submit).not.toHaveAttribute("aria-busy", "true")

    await submitForm()

    // Disabling alone leaves a screen reader with no signal that anything is
    // happening, since the label does not change.
    await waitFor(() => expect(submit).toHaveAttribute("aria-busy", "true"))
    expect(screen.getByText(copy.submitting)).toBeInTheDocument()
  })

  test("keeps the individual panel visible if the audience changes before a pending org submission resolves", async () => {
    setupApis()
    const submit = Promise.withResolvers<Record<string, never>>()
    setMockResponse.post(urls.hubspot.submit(FORM_ID), submit.promise)
    renderWithProviders(<OrgLeadForm />)

    await submitForm()
    await selectAudience(AUDIENCE.individual)

    // The org submission succeeds in the background while the individual
    // path is showing — that choice must keep controlling what renders,
    // not the async success arriving after the fact.
    await act(async () => {
      submit.resolve({})
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(
      screen.getByRole("link", { name: copy.individual.ctaLabel }),
    ).toBeInTheDocument()
    expect(screen.queryByText(copy.success.title)).not.toBeInTheDocument()

    // Confirm the submission really did succeed: switching back to the
    // organization path surfaces the confirmation.
    await selectAudience(AUDIENCE.organization)
    expect(await screen.findByText(copy.success.title)).toBeInTheDocument()
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
    expect(
      screen.getByRole("radio", { name: AUDIENCE.individual }),
    ).toBeInTheDocument()
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
    expect(
      screen.getByRole("radio", { name: AUDIENCE.individual }),
    ).toBeInTheDocument()
  })
})
