import React from "react"
import { screen } from "@testing-library/react"
import user from "@testing-library/user-event"
import { Select, SelectField } from "./SelectField"
import type { SelectFieldProps, SelectProps } from "./SelectField"

import { faker } from "@faker-js/faker/locale/en"
import MenuItem from "@mui/material/MenuItem"
import { renderWithTheme } from "../../test-utils"

describe("SelectField", () => {
  const setup = (props: Partial<SelectFieldProps>) => {
    const defaults = {
      name: "test-name",
      value: "value-1",
      label: "test-label",
    }
    const { rerender: _rerender } = renderWithTheme(
      <SelectField {...defaults} {...props}>
        <MenuItem value="value-1">Option 1</MenuItem>
        <MenuItem value="value-2">Option 2</MenuItem>
      </SelectField>,
    )
    const rerender = (newProps: Partial<SelectFieldProps>) => {
      _rerender(<SelectField {...defaults} {...newProps} />)
    }
    return { rerender }
  }

  it("Has a label", () => {
    const label = faker.lorem.words()
    setup({ label })
    screen.getByRole("combobox", { name: label })
  })

  it("Marks input as required if required", () => {
    const label = faker.lorem.words()
    setup({ label, required: true })
    const input = screen.getByRole("textbox", { hidden: true })
    expect(input).toBeRequired()
  })
})

describe("Select", () => {
  const setup = (props?: Partial<SelectProps>) => {
    const defaults = {
      name: "test-name",
      value: "",
      label: "test-label",
    }
    const { rerender: _rerender } = renderWithTheme(
      <Select {...defaults} {...props}>
        <MenuItem disabled value="">
          Please select an op
        </MenuItem>
        <MenuItem value="value-1">Option 1</MenuItem>
        <MenuItem value="value-2">Option 2</MenuItem>
      </Select>,
    )
    const rerender = (newProps: Partial<SelectFieldProps>) => {
      _rerender(<SelectField {...defaults} {...newProps} />)
    }
    return { rerender }
  }

  /**
   * This test exists to ensure our workaround for
   * https://github.com/mui/material-ui/issues/23747
   * is behaving as expected.
   */
  it("Applies class 'pointer-open' to menu if and only if opened via pointer", async () => {
    setup()
    const select = screen.getByRole("combobox")
    const getMenu = () => document.querySelector(".MuiMenu-root")

    // Opened via pointer; has class pointer-open
    await user.click(select)
    expect(getMenu()).toHaveClass("pointer-open")
    expect(document.activeElement).toHaveTextContent("Option 1")

    // close it
    await user.keyboard("{Escape}")
    expect(getMenu()).toBe(null)
    expect(document.activeElement).toBe(select)

    // open via keyboard, does NOT have class pointer-open
    await user.keyboard("{Enter}")
    expect(getMenu()).not.toHaveClass("pointer-open")
    expect(document.activeElement).toHaveTextContent("Option 1")
  })
})
