import React, { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react"
import {
  CheckboxChoiceField,
  CheckboxChoiceFieldProps,
} from "./CheckboxChoiceField"
import Typography from "@mui/material/Typography"

const StateWrapper = (props: CheckboxChoiceFieldProps) => {
  const [values, setValues] = useState(props.value)

  const handleChange = () => {
    setValues(
      Array.from(
        document.querySelectorAll("input[name='checkbox-group']:checked"),
      ).map((el) => el.getAttribute("value") || ""),
    )
  }
  return (
    <>
      <CheckboxChoiceField
        {...props}
        name="checkbox-group"
        choices={[
          { label: "Choice 1", value: "1" },
          { label: "Choice 2", value: "2" },
          { label: "Choice 3", value: "3" },
        ]}
        values={values}
        onChange={handleChange}
      />
      <br />
      <br />
      <Typography variant="body1">Selected: {values?.join(", ")}</Typography>
    </>
  )
}

const meta: Meta<typeof CheckboxChoiceField> = {
  title: "smoot-design/CheckboxChoiceField",
  component: StateWrapper,
  argTypes: {
    onChange: {
      action: "change",
    },
  },
}

export default meta

type Story = StoryObj<typeof CheckboxChoiceField>

export const WithoutLabel: Story = {}

export const WithLabel: Story = {
  args: {
    label: "CheckboxChoiceField",
  },
}

export const Disabled: Story = {
  args: {
    label: "CheckboxChoiceField disabled",
    disabled: true,
  },
}
