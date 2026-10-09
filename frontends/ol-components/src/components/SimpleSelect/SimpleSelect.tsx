import React from "react"
import { Select, SelectField } from "../SelectField/SelectField"
import type { SelectProps, SelectFieldProps } from "../SelectField/SelectField"
import { MenuItem } from "../MenuItem/MenuItem"

type SimpleSelectProps = Pick<
  SelectProps<string | string[]>,
  | "value"
  | "size"
  | "multiple"
  | "onChange"
  | "renderValue"
  | "className"
  | "name"
  /**
   * What the control is called. A combobox cannot take its name from its own
   * contents, and this one has no visible label to borrow -- it renders the
   * current selection and nothing else -- so without this it reaches a screen
   * reader unnamed.
   */
  | "aria-label"
> & {
  /**
   * The options for the dropdown
   */
  options: SimpleSelectOption[]
}

interface SimpleSelectOption {
  /**
   * value for the dropdown option
   */
  value: string
  /**
   * label for the dropdown option
   */
  label: React.ReactNode
  disabled?: boolean
}

/**
 * An input for selection via dropdown.
 */
const SimpleSelect: React.FC<SimpleSelectProps> = ({
  options,
  "aria-label": ariaLabel,
  ...others
}) => {
  return (
    <Select
      {...others}
      displayEmpty
      /**
       * Onto the element that carries `role="combobox"`, which is the one
       * that needs the name. Passed straight through, MUI puts it on the
       * root instead, where the role prohibits it and the combobox is left
       * unnamed either way.
       */
      SelectDisplayProps={ariaLabel ? { "aria-label": ariaLabel } : undefined}
    >
      {options.map(({ label, value, ...itemProps }) => (
        <MenuItem key={value} size={others.size} {...itemProps} value={value}>
          {label}
        </MenuItem>
      ))}
    </Select>
  )
}

type SimpleSelectFieldProps<V = unknown> = Pick<
  SelectFieldProps<V>,
  | "fullWidth"
  | "label"
  | "helpText"
  | "error"
  | "errorText"
  | "required"
  | "size"
  | "value"
  | "onChange"
  | "name"
  | "className"
  | "renderValue"
> & {
  /**
   * The options for the dropdown
   */
  options: SimpleSelectOption[]
}

/**
 * A form field for text input via select dropdowns. Supports labels, help text,
 * error text, and start/end adornments.
 */
const SimpleSelectField = function <V = unknown>({
  options,
  ...others
}: SimpleSelectFieldProps<V>) {
  return (
    <SelectField {...others}>
      {options.map(({ value, label, ...itemProps }) => (
        <MenuItem size={others.size} value={value} key={value} {...itemProps}>
          {label}
        </MenuItem>
      ))}
    </SelectField>
  )
}

export { SimpleSelect, SimpleSelectField }
export type { SimpleSelectProps, SimpleSelectFieldProps, SimpleSelectOption }
