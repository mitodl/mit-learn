import React from "react"
import { faker } from "@faker-js/faker/locale/en"
import { screen, act, waitFor } from "@testing-library/react"
import user from "@testing-library/user-event"
import { FormDialog } from "./FormDialog"
import type { FormDialogProps } from "./FormDialog"
import { ControlledPromise } from "ol-test-utilities"
import { renderWithTheme } from "../../test-utils"

const setup = (props?: Partial<FormDialogProps>) => {
  const onSubmit = jest.fn((e) => {
    e.persist() // because of React 16 event pooling
    e.preventDefault() // JSDom does not implement HTMLFormElement.prototype.requestSubmit
  })
  const onReset = jest.fn()
  const onClose = jest.fn()
  const defaultProps: FormDialogProps = {
    onSubmit,
    onReset,
    onClose,
    open: true,
    title: "Test Form",
    children: <div>Test Content</div>,
  }
  const view = renderWithTheme(<FormDialog {...defaultProps} {...props} />)
  const rerender = (props: Partial<FormDialogProps>) =>
    view.rerender(<FormDialog {...defaultProps} {...props} />)
  return { rerender, onSubmit, onReset, onClose }
}

test("It renders form content", () => {
  const testId = faker.lorem.slug()
  setup({
    children: <div data-testid={testId}>Test form content</div>,
  })
  screen.getByTestId(testId)
})

test("It calls submit when pressing submit", async () => {
  const { onSubmit } = setup()
  expect(onSubmit).not.toHaveBeenCalled()
  await user.click(screen.getByRole("button", { name: "Submit" }))
  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({ type: "submit" }),
  )
})

test.each([
  {
    desc: "'Cancel' button",
    getButton: () => screen.getByRole("button", { name: "Cancel" }),
  },
  {
    desc: "'X' button",
    getButton: () => screen.getByRole("button", { name: "Close" }),
  },
])("It calls onClose when pressing $desc", async ({ getButton }) => {
  const { onSubmit, onClose } = setup()

  expect(onClose).not.toHaveBeenCalled()
  await user.click(getButton())
  expect(onSubmit).not.toHaveBeenCalled()
  expect(onClose).toHaveBeenCalledTimes(1)
})

test("It resets the form when opening/closing the dialog", async () => {
  const { rerender, onReset } = setup({ open: false })

  expect(onReset).toHaveBeenCalledTimes(1)
  rerender({ open: true })
  expect(onReset).toHaveBeenCalledTimes(2)

  // props change, but 'open' stays same ... not called
  rerender({ open: true, children: <div>New Child</div> })
  expect(onReset).toHaveBeenCalledTimes(2)

  rerender({ open: false })
  expect(onReset).toHaveBeenCalledTimes(3)

  // props change, but 'open' stays same ... not called
  rerender({ open: false, children: <div>Another Child</div> })
  expect(onReset).toHaveBeenCalledTimes(3)
})

test("The submit button is disabled while submitting", async () => {
  const submission = new ControlledPromise<void>()
  const onSubmit = jest.fn((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    return submission
  })
  setup({ onSubmit })
  const submitButton = screen.getByRole("button", { name: "Submit" })
  expect(submitButton).not.toBeDisabled()
  await user.click(submitButton)
  expect(submitButton).toBeDisabled()

  act(submission.resolve)
  await waitFor(() => expect(submitButton).not.toBeDisabled())
})

test.each([
  {
    confirmText: undefined,
    expected: "Submit",
  },
  {
    confirmText: "Yes, save!",
    expected: "Yes, save!",
  },
])("The 'Submit' button text is customizable", ({ confirmText, expected }) => {
  setup({ confirmText })
  screen.getByRole("button", { name: expected })
})

test.each([
  {
    confirmText: undefined,
    expected: "Cancel",
  },
  {
    confirmText: "No, cancel!",
    expected: "No, cancel!",
  },
])("The 'Cancel' button text is customizable", ({ confirmText, expected }) => {
  setup({ confirmText })
  screen.getByRole("button", { name: expected })
})
