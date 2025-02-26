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
import { RiArrowDownSLine } from "@remixicon/react"

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
      ".MuiSelect-icon": {
        // MUI sizes icons via fontSize, remixicon doesn't.
        // This usually isn't an issue. In this case, we need to size the icon
        // MUI's way so that its transformations apply correctly.
        height: "1em",
        width: "1em",
      },
    },
    size === "small" && {
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
    size === "medium" && {
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
    size === "large" && {
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
  ],
)

const SelectIcon = styled(RiArrowDownSLine)({
  fontSize: "24px",
  height: "1em",
  width: "1em",
})

const POINTER_CLASSNAME = "pointer-open"
/**
 * WARNING: You likely do not need this component. Try one of
 *
 *  - `SimpleSelect`,
 *  - `SimpleSelectField`
 *
 * instead.
 */
function Select<Value = unknown>({ size, ...props }: SelectProps<Value>) {
  const menu = React.useRef<HTMLDivElement | null>(null)
  return (
    <MuiSelect
      variant="standard"
      {...props}
      size={size}
      IconComponent={SelectIcon}
      /**
       * The next three properties are a workaround to deal with
       * https://github.com/mui/material-ui/issues/23747
       *
       * Note: Another workaround is mentioned in the issue, but breaks
       * accessibility (https://github.com/mui/material-ui/issues/23747#issuecomment-2596590221)
       */
      onPointerDown={() => {
        // This likely isn't necessasry---the Menu unmounts on close.
        // But let's not rely on that.
        menu.current?.classList.remove(POINTER_CLASSNAME)
      }}
      onPointerUp={() => {
        menu.current?.classList.add(POINTER_CLASSNAME)
      }}
      MenuProps={{
        ref: menu,
        sx: {
          [`&.${POINTER_CLASSNAME} .MuiMenuItem-root.Mui-focusVisible`]: {
            outline: "none",
          },
        },
        onKeyDown: () => {
          menu.current?.classList.remove(POINTER_CLASSNAME)
        },
      }}
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
