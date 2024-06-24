import React from "react"
import MuiSelect from "@mui/material/Select"
import type {
  SelectProps as MuiSelectProps,
  SelectChangeEvent,
} from "@mui/material/Select"
import InputBase from "@mui/material/InputBase"
import type { InputBaseProps } from "@mui/material/InputBase"
import { FormFieldWrapper } from "../FormHelpers/FormHelpers"
import type { FormFieldWrapperProps } from "../FormHelpers/FormHelpers"
import styled from "@emotion/styled"
import { baseInputStyles } from "../Input/Input"

type SelectProps<Value = unknown> = Omit<
  MuiSelectProps<Value>,
  "input" | "size"
> & { size?: "small" | "medium" | "large"; inputProps?: SelectInputProps }
type SelectInputProps = Omit<InputBaseProps, "size"> & {
  size?: "small" | "medium" | "large"
}

const DEFAULT_SIZE = "medium"

const SelectInput = styled(InputBase as React.FC<SelectInputProps>)(
  ({ theme, size = DEFAULT_SIZE }) => [
    baseInputStyles(theme),
    {
      ".MuiInputBase-input": {
        boxSizing: "border-box",
        display: "inline-flex",
        alignItems: "center",
        "&:focus": {
          backgroundColor: "transparent",
        },
      },
    },
    size === "small" && {
      ...theme.typography.body3,
      height: "32px",
      ".MuiInputBase-input": {
        height: "100%",
        padding: "8px 12px",
      },
    },
    size === "medium" && {
      ...theme.typography.body2,
      height: "40px",
      ".MuiInputBase-input": {
        height: "100%",
        padding: "8px 12px",
      },
    },
    size === "large" && {
      ...theme.typography.body1,
      height: "48px",
      ".MuiInputBase-input": {
        height: "100%",
        padding: "8px 16px",
      },
    },
  ],
)

function Select<Value = unknown>({ size, ...props }: SelectProps<Value>) {
  return (
    <MuiSelect
      variant="standard"
      {...props}
      // @ts-expect-error MUI Typescript really wants Input and Select sizes
      // to be the same. But our Select has an extra "small" size.
      // Passing the size here generates the expected classes on root select.
      size={size}
      input={<SelectInput size={size} />}
    />
  )
}

type SelectFieldProps<Value = unknown> = Omit<
  FormFieldWrapperProps,
  "children"
> &
  SelectProps<Value>

/**
 * A form field for text input via dropdown. Supports labels, help text, error
 *  text, and start/end adornments.
 */
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
