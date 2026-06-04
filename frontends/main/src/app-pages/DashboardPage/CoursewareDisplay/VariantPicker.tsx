import React from "react"
import { Stack, Typography, styled } from "ol-components"
import { RiCheckboxFill } from "@remixicon/react"
import type { SupportedVariant } from "@mitodl/mitxonline-api-axios/v2"
import { buildVariantKey, buildVariantLabel } from "./model/dashboardViewModel"

const VariantPickerRoot = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: "24px",
  marginTop: "16px",
  padding: "24px",
  borderRadius: "8px",
  backgroundColor: theme.custom.colors.white,
  boxShadow: "0 1px 6px 0 rgba(3, 21, 45, 0.05)",
}))

const HiddenRadio = styled.input({
  position: "absolute",
  opacity: 0,
  width: "1px",
  height: "1px",
  margin: "-1px",
  overflow: "hidden",
  clip: "rect(0,0,0,0)",
  whiteSpace: "nowrap",
})

const VariantChoiceBox = styled("label", {
  shouldForwardProp: (prop) => prop !== "checked",
})<{ checked: boolean }>(({ theme, checked }) => ({
  display: "flex",
  flexDirection: "column",
  textAlign: "left",
  width: "284px",
  padding: "16px 24px",
  gap: "4px",
  borderRadius: "4px",
  backgroundColor: theme.custom.colors.white,
  // Keep the border width constant at 1px and thicken the selected/focused
  // state with an inset box-shadow instead of a 2px border. box-shadow does not
  // affect layout, so the card content no longer shifts when selected.
  border: `1px solid ${checked ? theme.custom.colors.red : theme.custom.colors.silverGrayLight}`,
  boxShadow: checked ? `inset 0 0 0 1px ${theme.custom.colors.red}` : "none",
  cursor: "pointer",
  "&:focus-within": {
    borderColor: theme.custom.colors.red,
    boxShadow: `inset 0 0 0 1px ${theme.custom.colors.red}`,
  },
}))

type VariantCardProps = {
  title: string
  subtitle?: string
  certEligible: boolean
  selected: boolean
  name: string
  value: string
  onChange: React.ChangeEventHandler<HTMLInputElement>
}

const VariantCard: React.FC<VariantCardProps> = ({
  title,
  subtitle,
  certEligible,
  selected,
  name,
  value,
  onChange,
}) => {
  return (
    <VariantChoiceBox checked={selected}>
      <HiddenRadio
        type="radio"
        name={name}
        value={value}
        checked={selected}
        onChange={onChange}
      />
      <Typography variant="subtitle1">{title}</Typography>
      {(certEligible || subtitle) && (
        // Keep both subtext kinds (the certificate badge and the variant
        // detail) in the same 20px-tall centered row so they align vertically
        // across cards regardless of whether the checkbox icon is present.
        <Stack direction="row" alignItems="center" gap="8px" minHeight="20px">
          {certEligible && <RiCheckboxFill size={20} />}
          <Typography variant="body3" color="darkGray2">
            {certEligible ? "Certificate Eligible" : subtitle}
          </Typography>
        </Stack>
      )}
    </VariantChoiceBox>
  )
}

type VariantChoiceBoxesProps = {
  variantOptions: SupportedVariant[]
  selectedVariant: SupportedVariant | null
  setSelectedVariant: (variant: SupportedVariant | null) => void
  defaultVariantLabel?: string
  customizedVariantLabel?: string
  "aria-label"?: string
  "aria-labelledby"?: string
}

const VariantChoiceBoxes: React.FC<VariantChoiceBoxesProps> = ({
  variantOptions,
  selectedVariant,
  setSelectedVariant,
  defaultVariantLabel,
  customizedVariantLabel,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledby,
}) => {
  const groupName = React.useId()
  const selectedValue = selectedVariant
    ? buildVariantKey(selectedVariant)
    : null
  const handleSelectedVariantChange = (value: string) => {
    const variant = variantOptions.find((option) => {
      const optionValue = buildVariantKey(option)
      return optionValue === value
    })
    setSelectedVariant(variant ?? null)
  }
  return (
    <Stack
      role="radiogroup"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledby}
      direction="row"
      gap="16px"
      flexWrap="wrap"
    >
      {variantOptions.map((variant) => {
        const value = buildVariantKey(variant)
        const detailLabel = buildVariantLabel(variant)
        // Default card: large title from defaultVariantLabel, "Certificate
        // Eligible" badge as subtext. Variant cards: "Customized <Contract>"
        // title with the language • industry • length detail as subtext.
        const title = variant.default_variant
          ? (defaultVariantLabel ?? detailLabel)
          : (customizedVariantLabel ?? detailLabel)
        const subtitle =
          !variant.default_variant && customizedVariantLabel
            ? detailLabel
            : undefined
        return (
          <VariantCard
            key={value}
            name={groupName}
            value={value}
            title={title}
            subtitle={subtitle}
            certEligible={variant.default_variant}
            selected={value === selectedValue}
            onChange={() => handleSelectedVariantChange(value)}
          />
        )
      })}
    </Stack>
  )
}

const SelectedVariantIndicator = styled.div(({ theme }) => ({
  display: "flex",
  height: "48px",
  padding: "8px 16px",
  alignItems: "center",
  gap: "16px",
  borderRadius: "8px",
  border: "0 solid",
  borderColor: theme.custom.colors.lightGray2,
  backgroundColor: theme.custom.colors.lightGray1,
}))

type VariantPickerProps = {
  variantOptions: SupportedVariant[]
  selectedVariant: SupportedVariant | null
  setSelectedVariant: (variant: SupportedVariant | null) => void
  defaultVariantLabel?: string
  customizedVariantLabel?: string
  title?: string
  description?: string
}

const VariantPicker: React.FC<VariantPickerProps> = ({
  variantOptions,
  selectedVariant,
  setSelectedVariant,
  defaultVariantLabel,
  customizedVariantLabel,
  title = "Available Versions",
  description,
}) => {
  const titleId = React.useId()
  let viewingLabel = ""
  if (selectedVariant) {
    const detailLabel = buildVariantLabel(selectedVariant)
    if (selectedVariant.default_variant) {
      viewingLabel = defaultVariantLabel ?? detailLabel
    } else if (customizedVariantLabel) {
      // e.g. "Customized Universal AI (English • Healthcare • Short)"
      viewingLabel = `${customizedVariantLabel} (${detailLabel})`
    } else {
      viewingLabel = detailLabel
    }
  }
  return (
    <VariantPickerRoot>
      <Typography id={titleId} variant="h5" component="h2">
        {title}
      </Typography>
      {description && <Typography variant="body2">{description}</Typography>}
      <VariantChoiceBoxes
        aria-labelledby={titleId}
        variantOptions={variantOptions}
        selectedVariant={selectedVariant}
        setSelectedVariant={setSelectedVariant}
        defaultVariantLabel={defaultVariantLabel}
        customizedVariantLabel={customizedVariantLabel}
      />
      <SelectedVariantIndicator>
        <Typography variant="body2">Viewing:</Typography>
        <Typography variant="subtitle2">{viewingLabel}</Typography>
      </SelectedVariantIndicator>
    </VariantPickerRoot>
  )
}

export { VariantPicker, VariantChoiceBoxes }
export type { VariantPickerProps, VariantChoiceBoxesProps }
