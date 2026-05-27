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
  border: `${checked ? "2px" : "1px"} solid ${checked ? theme.custom.colors.red : theme.custom.colors.silverGrayLight}`,
  cursor: "pointer",
}))

type VariantCardProps = {
  title: string
  certEligible: boolean
  selected: boolean
  name: string
  value: string
  onChange: React.ChangeEventHandler<HTMLInputElement>
}

const VariantCard: React.FC<VariantCardProps> = ({
  title,
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
      <Stack
        direction="row"
        alignItems="center"
        visibility={certEligible ? "visible" : "hidden"}
        gap="8px"
      >
        <RiCheckboxFill size={20} />
        <Typography variant="body3" color="darkGray2">
          Certificate Eligible
        </Typography>
      </Stack>
    </VariantChoiceBox>
  )
}

type VariantChoiceBoxesProps = {
  variantOptions: SupportedVariant[]
  selectedVariant: SupportedVariant | null
  setSelectedVariant: (variant: SupportedVariant | null) => void
}

const VariantChoiceBoxes: React.FC<VariantChoiceBoxesProps> = ({
  variantOptions,
  selectedVariant,
  setSelectedVariant,
}) => {
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
    <Stack direction="row" gap="16px" flexWrap="wrap">
      {variantOptions.map((variant) => {
        const value = buildVariantKey(variant)
        const label = buildVariantLabel(variant)
        return (
          <VariantCard
            key={value}
            name={`variant-option-${value}`}
            value={value}
            title={label}
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
  title?: string
  description?: string
}

const VariantPicker: React.FC<VariantPickerProps> = ({
  variantOptions,
  selectedVariant,
  setSelectedVariant,
  title = "Available Versions",
  description,
}) => {
  return (
    <VariantPickerRoot>
      <Typography variant="h5" component="h2">
        {title}
      </Typography>
      {description && <Typography variant="body2">{description}</Typography>}
      <VariantChoiceBoxes
        variantOptions={variantOptions}
        selectedVariant={selectedVariant}
        setSelectedVariant={setSelectedVariant}
      />
      <SelectedVariantIndicator>
        <Typography variant="body2">Viewing:</Typography>
        <Typography variant="subtitle2">
          {selectedVariant ? buildVariantLabel(selectedVariant) : ""}
        </Typography>
      </SelectedVariantIndicator>
    </VariantPickerRoot>
  )
}

export { VariantPicker, VariantChoiceBoxes }
export type { VariantPickerProps, VariantChoiceBoxesProps }
