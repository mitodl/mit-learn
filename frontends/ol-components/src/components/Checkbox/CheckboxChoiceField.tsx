import React from "react"
import { Checkbox, CheckboxProps } from "./Checkbox"
import FormControl from "@mui/material/FormControl"
import FormLabel from "@mui/material/FormLabel"
import styled from "@emotion/styled"

export type CheckboxChoiceFieldProps = {
  label?: React.ReactNode // We could make this optional, but we should demand one of (label, aria-label, aria-labelledby)
  value?: string[]
  name: string
  choices: Omit<CheckboxProps, "name" | "onChange">[]
  values?: string[]
  onChange?: CheckboxProps["onChange"]
  className?: string
  vertical?: boolean
  disabled?: boolean
}

const Container = styled.div(({ theme }) => ({
  display: "flex",
  gap: "32px",
  flexDirection: "row",
  [theme.breakpoints.down("md")]: {
    flexDirection: "column",
  },
}))

const VerticalContainer = styled(Container)({
  gap: "18px",
  flexDirection: "column",
})

const Label = styled(FormLabel)(({ theme }) => ({
  marginTop: "0",
  marginBottom: "16px",
  width: "100%",
  color: theme.custom.colors.darkGray2,
  ...theme.typography.subtitle2,
})) as typeof FormLabel // https://mui.com/material-ui/guides/typescript/?srsltid=AfmBOoo9kvRiALbxt4kAarRGiKaiJ7tbui5tstoL23DYscJPyk6UaTul#complications-with-the-component-prop

const CheckboxChoiceField: React.FC<CheckboxChoiceFieldProps> = ({
  label,
  name,
  choices,
  values,
  onChange,
  className,
  vertical = false,
  disabled = false,
}) => {
  const isChecked = (choice: CheckboxProps) =>
    choice.value ? (values?.includes(choice.value) ?? false) : false
  const _Container = vertical ? VerticalContainer : Container

  return (
    <FormControl
      component="fieldset"
      sx={{ width: "100%" }}
      className={className}
      disabled={disabled}
    >
      {label && <Label component="legend">{label}</Label>}
      <_Container>
        {choices.map((choice) => {
          return (
            <Checkbox
              key={choice.value}
              name={name}
              checked={isChecked(choice)}
              onChange={onChange}
              disabled={disabled}
              {...choice}
            />
          )
        })}
      </_Container>
    </FormControl>
  )
}

export { CheckboxChoiceField }
