import React from "react"
import { screen } from "@testing-library/react"
import { SelectField } from "./SelectField"
import type { SelectFieldProps } from "./SelectField"

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
