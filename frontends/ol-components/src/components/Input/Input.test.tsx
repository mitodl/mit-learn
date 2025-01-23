import React from "react"
import { screen } from "@testing-library/react"
import user from "@testing-library/user-event"
import { Input, AdornmentButton } from "./Input"
import { renderWithTheme } from "../../test-utils"

describe("AdornmentButton", () => {
  it("Does not steal focus from input when clicked", async () => {
    const onClick = jest.fn()
    renderWithTheme(
      <Input
        endAdornment={<AdornmentButton onClick={onClick}>Test</AdornmentButton>}
      />,
    )
    const input = screen.getByRole("textbox")
    const button = screen.getByRole("button", { name: "Test" })
    await user.click(input)
    expect(input).toHaveFocus()
    await user.click(button)
    expect(input).toHaveFocus()
    expect(onClick).toHaveBeenCalledTimes(1)

    // But it should still be focusable via keyboard
    await user.tab()
    expect(button).toHaveFocus()
  })
})
