import React from "react"
import { styled } from "@pigment-css/react"
import MuiSelect from "@mui/material/Select"
import type {
  SelectProps as MuiSelectProps,
  SelectChangeEvent,
} from "@mui/material/Select"
import InputBase from "@mui/material/InputBase"
import type { InputBaseProps } from "@mui/material/InputBase"
import { FormFieldWrapper } from "../FormHelpers/FormHelpers"
import type { FormFieldWrapperProps } from "../FormHelpers/FormHelpers"
import { baseInputStyles } from "../Input/Input"
import { RiArrowDownSLine } from "@remixicon/react"

type SelectProps<Value = unknown> = Omit<
  MuiSelectProps<Value>,
  "input" | "size"
> & { size?: "small" | "medium" | "large"; inputProps?: SelectInputProps }
type SelectInputProps = Omit<InputBaseProps, "size"> & {
  size?: "small" | "medium" | "large"
}

const DEFAULT_SIZE = "medium"

const SelectInput = styled(InputBase)(({ theme }) => ({
  ...baseInputStyles,
  ".MuiInputBase-input": {
    boxSizing: "border-box",
    display: "inline-flex",
    alignItems: "center",
    "&:focus": {
      backgroundColor: "transparent",
    },
  },
  ".MuiSelect-icon": {
    // MUI sizes icons via fontSize, remixicon doesn't.
    // This usually isn't an issue. In this case, we need to size the icon
    // MUI's way so that its transformations apply correctly.
    height: "1em",
    width: "1em",
  },
  variants: [
    {
      props: { size: "small" },
      style: {
        ...theme.typography.body3,
        height: "32px",
        ".MuiInputBase-input": {
          height: "100%",
          padding: "8px 12px",
        },
        "&&& .MuiInputBase-input": {
          paddingRight: "28px", // 12px + 16px icon
        },
        ".MuiSelect-icon": {
          fontSize: 16,
          right: "12px",
        },
      },
    },
    {
      props: ({ size }) => !size || size === DEFAULT_SIZE,
      style: {
        ...theme.typography.body2,
        height: "40px",
        ".MuiInputBase-input": {
          height: "100%",
          padding: "8px 12px",
        },
        "&&& .MuiInputBase-input": {
          paddingRight: "32px", // 12px + 20px icon
        },
        ".MuiSelect-icon": {
          fontSize: 20,
          right: "12px",
        },
      },
    },
    {
      props: { size: "large" },
      style: {
        ...theme.typography.body1,
        height: "48px",
        ".MuiInputBase-input": {
          height: "100%",
          padding: "8px 16px",
        },
        "&&& .MuiInputBase-input": {
          paddingRight: "40px", // 16px + 24px icon
        },
        ".MuiSelect-icon": {
          fontSize: 24,
          right: "16px",
        },
      },
    },
  ],
}))

const SelectIcon = styled(RiArrowDownSLine)({
  fontSize: "24px",
  height: "1em",
  width: "1em",
})

/**
 * WARNING: You likely do not need this component. Try one of
 *
 *  - `SimpleSelect`,
 *  - `SimpleSelectField`
 *
 * instead.
 */
function Select<Value = unknown>({ size, ...props }: SelectProps<Value>) {
  return (
    <MuiSelect
      variant="standard"
      {...props}
      size={size}
      IconComponent={SelectIcon}
      input={<SelectInput size={size} />}
    />
  )
}

type SelectFieldProps<Value = unknown> = Omit<
  FormFieldWrapperProps,
  "children"
> &
  SelectProps<Value>

function SelectField<Value = unknown>({
  label,
  required,
  className,
  id,
  fullWidth,
  error,
  errorText,
  helpText,
  ...props
}: SelectFieldProps<Value>) {
  const wrapperProps = {
    label,
    required,
    className,
    id,
    fullWidth,
    error,
    errorText,
    helpText,
  }
  return (
    <FormFieldWrapper {...wrapperProps}>
      {(childProps) => (
        <Select displayEmpty label={label} {...childProps} {...props} />
      )}
    </FormFieldWrapper>
  )
}

export { Select, SelectField }
export type { SelectChangeEvent, SelectProps, SelectFieldProps }
