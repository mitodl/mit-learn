import React from "react"
import { screen, waitFor } from "@testing-library/react"
import user from "@testing-library/user-event"

import { renderWithTheme } from "../../test-utils"
import { HubspotForm } from "./HubspotForm"

test("hydrates hidden field value from initialValues on mount", async () => {
  const onValuesChange = jest.fn()

  const form = {
    id: "test-form",
    field_groups: [
      {
        fields: [
          {
            name: "email",
            label: "Email",
            field_type: "email",
            hidden: false,
          },
          {
            name: "product",
            label: "Product",
            field_type: "multiple_checkboxes",
            hidden: true,
            options: [{ label: "Universal AI", value: "Universal AI" }],
          },
        ],
      },
    ],
  }

  renderWithTheme(
    <HubspotForm
      form={form}
      initialValues={{ product: ["Universal AI"] }}
      onValuesChange={onValuesChange}
    />,
  )

  await waitFor(() => {
    expect(onValuesChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ product: ["Universal AI"] }),
    )
  })
})

test("hydrates hidden multiple checkbox default from camelCase defaultValues", async () => {
  const onValuesChange = jest.fn()

  const form = {
    id: "test-form",
    field_groups: [
      {
        fields: [
          {
            name: "email",
            label: "Email",
            field_type: "email",
            hidden: false,
          },
          {
            name: "product",
            label: "Product",
            field_type: "multiple_checkboxes",
            hidden: true,
            defaultValues: ["Universal AI"],
            options: [{ label: "Universal AI", value: "Universal AI" }],
          },
        ],
      },
    ],
  }

  renderWithTheme(<HubspotForm form={form} onValuesChange={onValuesChange} />)

  await waitFor(() => {
    expect(onValuesChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ product: ["Universal AI"] }),
    )
  })
})

test("submits hidden multiple checkbox default from camelCase defaultValues", async () => {
  const onSubmit = jest.fn((values, event) => {
    event.preventDefault()
  })

  const form = {
    id: "test-form",
    field_groups: [
      {
        fields: [
          {
            name: "email",
            label: "Email",
            field_type: "email",
            hidden: false,
          },
          {
            name: "product",
            label: "Product",
            field_type: "multiple_checkboxes",
            hidden: true,
            defaultValues: ["Universal AI"],
            options: [{ label: "Universal AI", value: "Universal AI" }],
          },
        ],
      },
    ],
  }

  renderWithTheme(<HubspotForm form={form} onSubmit={onSubmit} />)

  await user.click(screen.getByRole("button", { name: "Submit" }))

  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({ product: ["Universal AI"] }),
    expect.anything(),
    null,
  )
})

test("treats null hidden multiple checkbox defaults as empty array", async () => {
  const onSubmit = jest.fn((values, event) => {
    event.preventDefault()
  })

  const form = {
    id: "test-form",
    field_groups: [
      {
        fields: [
          {
            name: "email",
            label: "Email",
            field_type: "email",
            hidden: false,
          },
          {
            name: "product",
            label: "Product",
            field_type: "multiple_checkboxes",
            hidden: true,
            defaultValues: null,
            options: [{ label: "Universal AI", value: "Universal AI" }],
          },
        ],
      },
    ],
  }

  renderWithTheme(<HubspotForm form={form} onSubmit={onSubmit} />)

  await user.click(screen.getByRole("button", { name: "Submit" }))

  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({ product: [] }),
    expect.anything(),
    null,
  )
})
