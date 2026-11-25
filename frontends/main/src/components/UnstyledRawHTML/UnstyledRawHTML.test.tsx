import React from "react"
import { render, screen } from "@testing-library/react"
import UnstyledRawHTML from "./UnstyledRawHTML"

test("allows mailto: links to keep their href", () => {
  render(<UnstyledRawHTML html='<a href="mailto:learn@mit.edu">Email us</a>' />)
  const link = screen.getByRole("link", { name: "Email us" })
  expect(link).toHaveAttribute("href", "mailto:learn@mit.edu")
})

test("strips disallowed URI schemes like javascript:", () => {
  render(<UnstyledRawHTML html='<a href="javascript:alert(1)">Click</a>' />)
  const link = screen.getByText("Click")
  expect(link).not.toHaveAttribute("href")
})

test("opens external links in a new tab", () => {
  render(<UnstyledRawHTML html='<a href="https://ocw.mit.edu">OCW</a>' />)
  expect(screen.getByRole("link", { name: "OCW" })).toHaveAttribute(
    "target",
    "_blank",
  )
})

test("leaves anchors without an href alone", () => {
  render(<UnstyledRawHTML html='<a href="/relative">Rel</a>' />)
  expect(screen.getByText("Rel")).not.toHaveAttribute("target")
})
