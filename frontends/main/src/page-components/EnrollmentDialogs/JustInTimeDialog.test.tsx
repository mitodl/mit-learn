import {
  act,
  renderWithProviders,
  screen,
  setMockResponse,
  user,
  waitFor,
  within,
} from "@/test-utils"
import { makeRequest } from "api/test-utils"
import {
  urls as mitxUrls,
  factories as mitxFactories,
} from "api/mitxonline-test-utils"
import type { User as MitxUser } from "@mitodl/mitxonline-api-axios/v2"
import type { PartialDeep } from "type-fest"
import NiceModal from "@ebay/nice-modal-react"
import { getDescriptionFor } from "ol-test-utilities"
import { JustInTimeDialog } from "./JustInTimeDialog"

const COUNTRIES = [
  {
    code: "US",
    name: "United States",
    states: [
      { code: "US-MA", name: "Massachusetts" },
      { code: "US-NY", name: "New York" },
    ],
  },
  {
    code: "CA",
    name: "Canada",
    states: [{ code: "CA-ON", name: "Ontario" }],
  },
  { code: "GB", name: "United Kingdom", states: [] },
]

const setup = (userOverrides: PartialDeep<MitxUser> = {}) => {
  const mitxUser = mitxFactories.user.user({
    email: "learner@mit.edu",
    legal_address: null,
    user_profile: null,
    compliance_missing_fields: ["city", "country", "street_address_1"],
    ...userOverrides,
  })
  setMockResponse.get(mitxUrls.userMe.get(), mitxUser)
  setMockResponse.get(mitxUrls.countries.list(), COUNTRIES)
  setMockResponse.patch(mitxUrls.userMe.get(), null)
  return { mitxUser }
}

const openDialog = async () => {
  renderWithProviders(null)
  await act(async () => {
    NiceModal.show(JustInTimeDialog)
  })
  return screen.findByRole("dialog", { name: "Just a Few More Details" })
}

const textbox = (dialog: HTMLElement, name: string) =>
  within(dialog).getByRole("textbox", { name })
const combobox = (dialog: HTMLElement, name: string) =>
  within(dialog).getByRole("combobox", { name })

const chooseOption = async (control: HTMLElement, optionName: string) => {
  await user.click(control)
  await user.click(await screen.findByRole("option", { name: optionName }))
}

const patchCalls = () =>
  jest
    .mocked(makeRequest)
    .mock.calls.map(([request]) => request)
    .filter(
      ({ method, url }) => method === "patch" && url === mitxUrls.userMe.get(),
    )

describe("JustInTimeDialog", () => {
  test("collects every export-compliance field plus year of birth", async () => {
    setup()
    const dialog = await openDialog()

    // Rendered whether or not the API reported them missing, so a value that is
    // present but wrong can still be corrected.
    ;[
      "First Name",
      "Last Name",
      "Address",
      "Address Line 2 (optional)",
      "City",
    ].forEach((label) => expect(textbox(dialog, label)).toBeVisible())

    expect(combobox(dialog, "Country")).toBeVisible()
    expect(combobox(dialog, "Year of Birth")).toBeVisible()
  })

  test("email is shown but not editable, since SSO owns it", async () => {
    setup()
    const dialog = await openDialog()

    const email = textbox(dialog, "Email")
    await waitFor(() => expect(email).toHaveValue("learner@mit.edu"))
    expect(email).toHaveAttribute("readonly")
  })

  test("prefills the fields already on file so wrong values can be corrected", async () => {
    setup({
      legal_address: {
        first_name: "Ada",
        last_name: "Lovelace",
        country: "GB",
        city: "London",
      },
      user_profile: { year_of_birth: 1988 },
    })
    const dialog = await openDialog()

    await waitFor(() =>
      expect(textbox(dialog, "First Name")).toHaveValue("Ada"),
    )
    expect(textbox(dialog, "Last Name")).toHaveValue("Lovelace")
    expect(textbox(dialog, "City")).toHaveValue("London")
    expect(combobox(dialog, "Country")).toHaveTextContent("United Kingdom")
    expect(combobox(dialog, "Year of Birth")).toHaveTextContent("1988")
    // Not on file, so still empty rather than absent.
    expect(textbox(dialog, "Address")).toHaveValue("")
  })

  describe("country-conditional subdivision fields", () => {
    test("State and Postal Code are absent for a country with no subdivisions", async () => {
      setup({ legal_address: { country: "GB" } })
      const dialog = await openDialog()

      await waitFor(() =>
        expect(combobox(dialog, "Country")).toHaveTextContent("United Kingdom"),
      )
      expect(
        within(dialog).queryByRole("combobox", { name: "State/Province" }),
      ).not.toBeInTheDocument()
      expect(
        within(dialog).queryByRole("textbox", { name: "Postal Code" }),
      ).not.toBeInTheDocument()
      expect(
        within(dialog).queryByRole("textbox", { name: "Zip Code" }),
      ).not.toBeInTheDocument()
    })

    test("selecting the US reveals State and a Zip Code field, and announces the new requirement", async () => {
      // compliance_missing_fields cannot warn about these: it is computed from
      // the country already stored, which here is none.
      setup()
      const dialog = await openDialog()

      await chooseOption(combobox(dialog, "Country"), "United States")

      const state = await within(dialog).findByRole("combobox", {
        name: "State/Province",
      })
      expect(state).toBeVisible()
      await chooseOption(state, "Massachusetts")
      expect(state).toHaveTextContent("Massachusetts")

      // US uses local terminology, not the generic "Postal Code" label.
      expect(textbox(dialog, "Zip Code")).toBeVisible()
      expect(
        within(dialog).queryByRole("textbox", { name: "Postal Code" }),
      ).not.toBeInTheDocument()

      expect(
        within(dialog).getByText(
          "State/Province and Zip Code are required for United States.",
        ),
      ).toBeInTheDocument()
    })

    test("selecting Canada reveals State and a Postal Code field (not Zip Code)", async () => {
      setup()
      const dialog = await openDialog()

      await chooseOption(combobox(dialog, "Country"), "Canada")

      const state = await within(dialog).findByRole("combobox", {
        name: "State/Province",
      })
      expect(state).toBeVisible()

      expect(textbox(dialog, "Postal Code")).toBeVisible()
      expect(
        within(dialog).queryByRole("textbox", { name: "Zip Code" }),
      ).not.toBeInTheDocument()

      expect(
        within(dialog).getByText(
          "State/Province and Postal Code are required for Canada.",
        ),
      ).toBeInTheDocument()
    })

    test("switching to a country without subdivisions clears the chosen state and postal code", async () => {
      setup()
      const dialog = await openDialog()

      await chooseOption(combobox(dialog, "Country"), "United States")
      await chooseOption(
        await within(dialog).findByRole("combobox", { name: "State/Province" }),
        "Massachusetts",
      )
      await user.type(textbox(dialog, "Zip Code"), "02139")
      await chooseOption(combobox(dialog, "Country"), "United Kingdom")

      await waitFor(() =>
        expect(
          within(dialog).queryByRole("combobox", { name: "State/Province" }),
        ).not.toBeInTheDocument(),
      )
      expect(
        within(dialog).queryByRole("textbox", { name: "Zip Code" }),
      ).not.toBeInTheDocument()
      expect(
        within(dialog).queryByRole("textbox", { name: "Postal Code" }),
      ).not.toBeInTheDocument()

      // Re-selecting the US must not resurrect the stale subdivision or postal code.
      await chooseOption(combobox(dialog, "Country"), "United States")
      const state = await within(dialog).findByRole("combobox", {
        name: "State/Province",
      })
      expect(state).toHaveTextContent("Please Select")
      expect(textbox(dialog, "Zip Code")).toHaveValue("")
    })
  })

  describe("validation", () => {
    test("blocks submission and explains each empty required field", async () => {
      setup()
      const dialog = await openDialog()

      await user.click(within(dialog).getByRole("button", { name: "Submit" }))

      const expectations: [string, string][] = [
        ["First Name", "First name is required"],
        ["Last Name", "Last name is required"],
        ["Address", "Address is required"],
        ["City", "City is required"],
      ]
      for (const [label, message] of expectations) {
        const field = textbox(dialog, label)
        expect(field).toBeInvalid()
        expect(getDescriptionFor(field)).toHaveTextContent(message)
      }
      expect(getDescriptionFor(combobox(dialog, "Country"))).toHaveTextContent(
        "Country is required",
      )
      expect(
        getDescriptionFor(combobox(dialog, "Year of Birth")),
      ).toHaveTextContent("Year of birth is required")

      expect(patchCalls()).toHaveLength(0)
    })

    test("moves focus to the first field needing attention", async () => {
      setup({
        legal_address: { first_name: "Ada", country: "GB", city: "London" },
      })
      const dialog = await openDialog()
      await waitFor(() =>
        expect(textbox(dialog, "First Name")).toHaveValue("Ada"),
      )

      await user.click(within(dialog).getByRole("button", { name: "Submit" }))

      // First Name is filled, so Last Name is the first outstanding field.
      expect(textbox(dialog, "Last Name")).toHaveFocus()
    })

    test("whitespace does not satisfy a required field", async () => {
      setup()
      const dialog = await openDialog()

      await user.type(textbox(dialog, "First Name"), "   ")
      await user.click(within(dialog).getByRole("button", { name: "Submit" }))

      expect(
        getDescriptionFor(textbox(dialog, "First Name")),
      ).toHaveTextContent("First name is required")
      expect(patchCalls()).toHaveLength(0)
    })

    test("postal code is neither shown nor required outside the US and Canada", async () => {
      setup({
        legal_address: {
          first_name: "Ada",
          last_name: "Lovelace",
          country: "GB",
          street_address_1: "1 Main St",
          city: "London",
        },
        user_profile: { year_of_birth: 1988 },
      })
      const dialog = await openDialog()
      await waitFor(() => expect(textbox(dialog, "City")).toHaveValue("London"))

      expect(
        within(dialog).queryByRole("textbox", { name: "Postal Code" }),
      ).not.toBeInTheDocument()

      await user.click(within(dialog).getByRole("button", { name: "Submit" }))

      await waitFor(() => expect(patchCalls()).toHaveLength(1))
    })
  })

  describe("submission", () => {
    test("saves the address and year of birth, and never the email", async () => {
      setup()
      const dialog = await openDialog()

      await user.type(textbox(dialog, "First Name"), "Ada")
      await user.type(textbox(dialog, "Last Name"), "Lovelace")
      await user.type(textbox(dialog, "Address"), "1 Main St")
      await user.type(textbox(dialog, "City"), "Cambridge")
      await chooseOption(combobox(dialog, "Country"), "United States")
      await chooseOption(
        await within(dialog).findByRole("combobox", { name: "State/Province" }),
        "Massachusetts",
      )
      // US uses "Zip Code", not the generic "Postal Code" label.
      await user.type(textbox(dialog, "Zip Code"), "02139")
      await chooseOption(combobox(dialog, "Year of Birth"), "1988")

      await user.click(within(dialog).getByRole("button", { name: "Submit" }))

      await waitFor(() => expect(patchCalls()).toHaveLength(1))
      expect(patchCalls()[0].body).toEqual({
        legal_address: {
          first_name: "Ada",
          last_name: "Lovelace",
          country: "US",
          street_address_1: "1 Main St",
          street_address_2: "",
          city: "Cambridge",
          state: "US-MA",
          postal_code: "02139",
        },
        user_profile: { year_of_birth: 1988 },
      })
      expect(patchCalls()[0].body).not.toHaveProperty("email")
    }, 10000)

    test("closes once saved, so the caller can resume the action", async () => {
      setup({
        legal_address: {
          first_name: "Ada",
          last_name: "Lovelace",
          country: "GB",
          street_address_1: "1 Main St",
          city: "London",
        },
        user_profile: { year_of_birth: 1988 },
      })
      const dialog = await openDialog()
      await waitFor(() => expect(textbox(dialog, "City")).toHaveValue("London"))

      await user.click(within(dialog).getByRole("button", { name: "Submit" }))

      await waitFor(() =>
        expect(
          screen.queryByRole("dialog", { name: "Just a Few More Details" }),
        ).not.toBeInTheDocument(),
      )
    })

    test("stays open and explains a failed save", async () => {
      setup()
      setMockResponse.patch(mitxUrls.userMe.get(), null, { code: 500 })
      const dialog = await openDialog()

      await user.type(textbox(dialog, "First Name"), "Ada")
      await user.type(textbox(dialog, "Last Name"), "Lovelace")
      await user.type(textbox(dialog, "Address"), "1 Main St")
      await user.type(textbox(dialog, "City"), "London")
      await chooseOption(combobox(dialog, "Country"), "United Kingdom")
      await chooseOption(combobox(dialog, "Year of Birth"), "1988")

      await user.click(within(dialog).getByRole("button", { name: "Submit" }))

      expect(
        await within(dialog).findByText(
          "There was a problem saving your details. Please try again later.",
        ),
      ).toBeInTheDocument()
      // The entered values survive so the user can retry without retyping.
      expect(textbox(dialog, "First Name")).toHaveValue("Ada")
    }, 10000)

    test("cancelling saves nothing", async () => {
      setup()
      const dialog = await openDialog()

      await user.click(within(dialog).getByRole("button", { name: "Cancel" }))

      expect(patchCalls()).toHaveLength(0)
      await waitFor(() =>
        expect(
          screen.queryByRole("dialog", { name: "Just a Few More Details" }),
        ).not.toBeInTheDocument(),
      )
    })
  })
})
