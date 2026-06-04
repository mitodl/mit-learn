import React from "react"
import { screen } from "@testing-library/react"
import { renderWithProviders, user, within } from "@/test-utils"
import {
  LanguageEnum,
  type SupportedVariant,
} from "@mitodl/mitxonline-api-axios/v2"
import { VariantPicker } from "./VariantPicker"

const makeVariant = (
  overrides: Partial<SupportedVariant> = {},
): SupportedVariant => ({
  language: LanguageEnum.En,
  variant_industry: "",
  variant_length: "",
  active: true,
  b2b_only: true,
  default_variant: false,
  ...overrides,
})

const enDefault = makeVariant({
  language: LanguageEnum.En,
  default_variant: true,
})
const esVariant = makeVariant({
  language: LanguageEnum.EsEs,
  default_variant: false,
})

describe("VariantPicker", () => {
  describe("defaultVariantLabel", () => {
    test("uses defaultVariantLabel for the default variant card title instead of the computed label", () => {
      renderWithProviders(
        <VariantPicker
          variantOptions={[enDefault, esVariant]}
          selectedVariant={enDefault}
          setSelectedVariant={jest.fn()}
          defaultVariantLabel="Universal AI Program"
        />,
      )

      expect(
        screen.getByRole("radio", { name: /Universal AI Program/ }),
      ).toBeInTheDocument()
    })

    test("uses the computed label for the default variant card when defaultVariantLabel is not provided", () => {
      renderWithProviders(
        <VariantPicker
          variantOptions={[enDefault, esVariant]}
          selectedVariant={enDefault}
          setSelectedVariant={jest.fn()}
        />,
      )

      // The computed label for (en, "", "") is "English • General • Full"
      expect(
        screen.getByRole("radio", { name: /English.*General.*Full/ }),
      ).toBeInTheDocument()
    })

    test("does not apply defaultVariantLabel to non-default variant cards", () => {
      renderWithProviders(
        <VariantPicker
          variantOptions={[enDefault, esVariant]}
          selectedVariant={esVariant}
          setSelectedVariant={jest.fn()}
          defaultVariantLabel="Universal AI Program"
        />,
      )

      // Spanish card should still use computed label, not the default label
      expect(
        screen.getByRole("radio", { name: /español.*General.*Full/ }),
      ).toBeInTheDocument()
    })

    test("shows defaultVariantLabel in the Viewing indicator when the default variant is selected", async () => {
      renderWithProviders(
        <VariantPicker
          variantOptions={[enDefault, esVariant]}
          selectedVariant={enDefault}
          setSelectedVariant={jest.fn()}
          defaultVariantLabel="Universal AI Program"
        />,
      )

      // Label appears in both the card title and the Viewing indicator
      expect(screen.getAllByText("Universal AI Program")).toHaveLength(2)
      // Confirm the "Viewing:" prefix is present
      expect(screen.getByText("Viewing:")).toBeInTheDocument()
    })

    test("shows computed label in Viewing indicator when defaultVariantLabel not provided", () => {
      renderWithProviders(
        <VariantPicker
          variantOptions={[enDefault, esVariant]}
          selectedVariant={enDefault}
          setSelectedVariant={jest.fn()}
        />,
      )

      // Label appears in both the card title and the Viewing indicator
      expect(screen.getAllByText("English • General • Full")).toHaveLength(2)
    })

    test("shows the computed label for a non-default variant in the Viewing indicator", () => {
      renderWithProviders(
        <VariantPicker
          variantOptions={[enDefault, esVariant]}
          selectedVariant={esVariant}
          setSelectedVariant={jest.fn()}
          defaultVariantLabel="Universal AI Program"
        />,
      )

      // Spanish label in JSDOM uses Intl.DisplayNames form; appears in card + Viewing indicator
      expect(screen.getAllByText(/español.*General.*Full/)).toHaveLength(2)
    })
  })
})

describe("customizedVariantLabel", () => {
  test("non-default variant cards use 'Customized <name>' as the title with the language/industry/length detail as subtext", () => {
    renderWithProviders(
      <VariantPicker
        variantOptions={[enDefault, esVariant]}
        selectedVariant={esVariant}
        setSelectedVariant={jest.fn()}
        defaultVariantLabel="Universal AI Program"
        customizedVariantLabel="Customized Universal AI"
      />,
    )

    const esRadio = screen.getByRole("radio", {
      name: /Customized Universal AI/,
    })
    // the language/industry/length detail moves to the card subtext
    expect(esRadio).toHaveAccessibleName(/español.*General.*Full/)
  })

  test("the Viewing indicator shows 'Customized <name> (detail)' for a selected non-default variant", () => {
    renderWithProviders(
      <VariantPicker
        variantOptions={[enDefault, esVariant]}
        selectedVariant={esVariant}
        setSelectedVariant={jest.fn()}
        defaultVariantLabel="Universal AI Program"
        customizedVariantLabel="Customized Universal AI"
      />,
    )

    const indicator = screen.getByText("Viewing:").closest("div")!
    expect(
      within(indicator).getByText(
        /Customized Universal AI \(español.*General.*Full\)/,
      ),
    ).toBeInTheDocument()
  })

  test("does not apply customizedVariantLabel to the default variant card", () => {
    renderWithProviders(
      <VariantPicker
        variantOptions={[enDefault, esVariant]}
        selectedVariant={enDefault}
        setSelectedVariant={jest.fn()}
        defaultVariantLabel="Universal AI Program"
        customizedVariantLabel="Customized Universal AI"
      />,
    )

    const defaultRadio = screen.getByRole("radio", {
      name: /Universal AI Program/,
    })
    expect(defaultRadio).toHaveAccessibleName(/Certificate Eligible/)
    expect(defaultRadio).not.toHaveAccessibleName(/Customized/)
  })
})

describe("VariantPicker rendering", () => {
  test("renders the default title 'Available Versions'", () => {
    renderWithProviders(
      <VariantPicker
        variantOptions={[enDefault, esVariant]}
        selectedVariant={enDefault}
        setSelectedVariant={jest.fn()}
      />,
    )

    screen.getByRole("heading", { name: "Available Versions" })
  })

  test("renders a custom title when the title prop is provided", () => {
    renderWithProviders(
      <VariantPicker
        variantOptions={[enDefault, esVariant]}
        selectedVariant={enDefault}
        setSelectedVariant={jest.fn()}
        title="Choose Your Path"
      />,
    )

    screen.getByRole("heading", { name: "Choose Your Path" })
    expect(
      screen.queryByRole("heading", { name: "Available Versions" }),
    ).not.toBeInTheDocument()
  })

  test("renders the description when provided", () => {
    renderWithProviders(
      <VariantPicker
        variantOptions={[enDefault, esVariant]}
        selectedVariant={enDefault}
        setSelectedVariant={jest.fn()}
        description="Pick the version that fits your goals."
      />,
    )

    screen.getByText("Pick the version that fits your goals.")
  })

  test("does not render a description element when description is not provided", () => {
    renderWithProviders(
      <VariantPicker
        variantOptions={[enDefault, esVariant]}
        selectedVariant={enDefault}
        setSelectedVariant={jest.fn()}
      />,
    )

    expect(
      screen.queryByText("Pick the version that fits your goals."),
    ).not.toBeInTheDocument()
  })
})

describe("VariantPicker certificate badge", () => {
  test("the default variant card includes 'Certificate Eligible' in its accessible name", () => {
    renderWithProviders(
      <VariantPicker
        variantOptions={[enDefault, esVariant]}
        selectedVariant={enDefault}
        setSelectedVariant={jest.fn()}
      />,
    )

    // Only the default_variant radio should include "Certificate Eligible"
    const certEligibleRadios = screen.getAllByRole("radio", {
      name: /Certificate Eligible/,
    })
    expect(certEligibleRadios).toHaveLength(1)
  })

  test("non-default variant cards do not include 'Certificate Eligible' in their accessible name", () => {
    renderWithProviders(
      <VariantPicker
        variantOptions={[enDefault, esVariant]}
        selectedVariant={esVariant}
        setSelectedVariant={jest.fn()}
      />,
    )

    const esRadio = screen.getByRole("radio", {
      name: /español.*General.*Full/,
    })
    expect(esRadio).not.toHaveAccessibleName(/Certificate Eligible/)
  })
})

describe("VariantPicker selection", () => {
  test("the radio for the selected variant is checked", () => {
    renderWithProviders(
      <VariantPicker
        variantOptions={[enDefault, esVariant]}
        selectedVariant={esVariant}
        setSelectedVariant={jest.fn()}
      />,
    )

    const esRadio = screen.getByRole("radio", {
      name: /español.*General.*Full/,
    })
    const enRadio = screen.getByRole("radio", {
      name: /English.*General.*Full/,
    })
    expect(esRadio).toBeChecked()
    expect(enRadio).not.toBeChecked()
  })

  test("clicking a card calls setSelectedVariant with the correct variant", async () => {
    const setSelectedVariant = jest.fn()
    renderWithProviders(
      <VariantPicker
        variantOptions={[enDefault, esVariant]}
        selectedVariant={enDefault}
        setSelectedVariant={setSelectedVariant}
      />,
    )

    const esRadio = screen.getByRole("radio", {
      name: /español.*General.*Full/,
    })
    await user.click(esRadio)
    expect(setSelectedVariant).toHaveBeenCalledWith(esVariant)
    expect(setSelectedVariant).toHaveBeenCalledTimes(1)
  })

  test("shows empty Viewing indicator when selectedVariant is null", () => {
    renderWithProviders(
      <VariantPicker
        variantOptions={[enDefault, esVariant]}
        selectedVariant={null}
        setSelectedVariant={jest.fn()}
      />,
    )

    screen.getByText("Viewing:")
    // Variant labels appear only in the cards (once each), not also in the indicator
    expect(screen.getAllByText(/English.*General.*Full/)).toHaveLength(1)
  })

  test("the Viewing indicator shows the label of the currently selected variant", () => {
    renderWithProviders(
      <VariantPicker
        variantOptions={[enDefault, esVariant]}
        selectedVariant={esVariant}
        setSelectedVariant={jest.fn()}
      />,
    )

    const indicator = screen.getByText("Viewing:").closest("div")!
    expect(
      within(indicator as HTMLElement).getByText(/español.*General.*Full/),
    ).toBeInTheDocument()
  })
})
