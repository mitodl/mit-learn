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

const DEFAULT_LABEL = "Universal AI Program"
const CUSTOMIZED_LABEL = "Customized Universal AI"

// defaultVariantLabel and customizedVariantLabel are required props; provide
// them here so each test only specifies what it actually exercises.
const renderPicker = (
  props: Partial<React.ComponentProps<typeof VariantPicker>> = {},
) =>
  renderWithProviders(
    <VariantPicker
      variantOptions={[enDefault, esVariant]}
      selectedVariant={null}
      setSelectedVariant={jest.fn()}
      defaultVariantLabel={DEFAULT_LABEL}
      customizedVariantLabel={CUSTOMIZED_LABEL}
      {...props}
    />,
  )

describe("VariantPicker labels", () => {
  test("the default variant card title is defaultVariantLabel, not the computed label", () => {
    renderPicker({ selectedVariant: enDefault })

    const defaultRadio = screen.getByRole("radio", {
      name: /Universal AI Program/,
    })
    expect(defaultRadio).toHaveAccessibleName(/Certificate Eligible/)
    expect(defaultRadio).not.toHaveAccessibleName(/Customized/)
  })

  test("non-default variant cards use 'Customized <name>' as the title with the language/industry/length detail as subtext", () => {
    renderPicker({ selectedVariant: esVariant })

    const esRadio = screen.getByRole("radio", {
      name: /Customized Universal AI/,
    })
    // the language/industry/length detail moves to the card subtext
    expect(esRadio).toHaveAccessibleName(/español.*General.*Full/i)
    // the default label does not leak onto the variant card
    expect(esRadio).not.toHaveAccessibleName(/Universal AI Program/)
  })
})

describe("VariantPicker Viewing indicator", () => {
  test("shows defaultVariantLabel when the default variant is selected", () => {
    renderPicker({ selectedVariant: enDefault })

    // Label appears in both the card title and the Viewing indicator
    expect(screen.getAllByText("Universal AI Program")).toHaveLength(2)
    expect(screen.getByText("Viewing:")).toBeInTheDocument()
  })

  test("shows 'Customized <name> (detail)' for a selected non-default variant", () => {
    renderPicker({ selectedVariant: esVariant })

    const indicator = screen.getByText("Viewing:").closest("div")!
    expect(
      within(indicator).getByText(
        /Customized Universal AI \(español.*General.*Full\)/i,
      ),
    ).toBeInTheDocument()
  })

  test("is empty when no variant is selected", () => {
    renderPicker({ selectedVariant: null })

    expect(screen.getByText("Viewing:")).toBeInTheDocument()
    // The default label appears only in its card, not also in the indicator
    expect(screen.getAllByText("Universal AI Program")).toHaveLength(1)
  })
})

describe("VariantPicker rendering", () => {
  test("renders the default title 'Available Versions'", () => {
    renderPicker({ selectedVariant: enDefault })

    screen.getByRole("heading", { name: "Available Versions" })
  })

  test("renders a custom title when the title prop is provided", () => {
    renderPicker({ selectedVariant: enDefault, title: "Choose Your Path" })

    screen.getByRole("heading", { name: "Choose Your Path" })
    expect(
      screen.queryByRole("heading", { name: "Available Versions" }),
    ).not.toBeInTheDocument()
  })

  test("renders the description when provided", () => {
    renderPicker({
      selectedVariant: enDefault,
      description: "Pick the version that fits your goals.",
    })

    screen.getByText("Pick the version that fits your goals.")
  })

  test("does not render a description element when description is not provided", () => {
    renderPicker({ selectedVariant: enDefault })

    expect(
      screen.queryByText("Pick the version that fits your goals."),
    ).not.toBeInTheDocument()
  })
})

describe("VariantPicker certificate badge", () => {
  test("the default variant card includes 'Certificate Eligible' in its accessible name", () => {
    renderPicker({ selectedVariant: enDefault })

    // Only the default_variant radio should include "Certificate Eligible"
    const certEligibleRadios = screen.getAllByRole("radio", {
      name: /Certificate Eligible/,
    })
    expect(certEligibleRadios).toHaveLength(1)
  })

  test("non-default variant cards do not include 'Certificate Eligible' in their accessible name", () => {
    renderPicker({ selectedVariant: esVariant })

    const esRadio = screen.getByRole("radio", {
      name: /español.*General.*Full/i,
    })
    expect(esRadio).not.toHaveAccessibleName(/Certificate Eligible/)
  })
})

describe("VariantPicker selection", () => {
  test("the radio for the selected variant is checked", () => {
    renderPicker({ selectedVariant: esVariant })

    const esRadio = screen.getByRole("radio", {
      name: /español.*General.*Full/i,
    })
    const enRadio = screen.getByRole("radio", { name: /Universal AI Program/ })
    expect(esRadio).toBeChecked()
    expect(enRadio).not.toBeChecked()
  })

  test("clicking a card calls setSelectedVariant with the correct variant", async () => {
    const setSelectedVariant = jest.fn()
    renderPicker({ selectedVariant: enDefault, setSelectedVariant })

    const esRadio = screen.getByRole("radio", {
      name: /español.*General.*Full/i,
    })
    await user.click(esRadio)
    expect(setSelectedVariant).toHaveBeenCalledWith(esVariant)
    expect(setSelectedVariant).toHaveBeenCalledTimes(1)
  })
})
