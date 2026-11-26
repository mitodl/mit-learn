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
  render(<UnstyledRawHTML html='<a name="faq-top">Top</a>' />)
  const anchor = screen.getByText("Top")
  expect(anchor).toHaveAttribute("name", "faq-top")
  expect(anchor).not.toHaveAttribute("target")
})

test("keeps markup in attribute values inert when adding link targets", () => {
  // jest's jsdom, like older browsers, leaves "<" and ">" raw inside attribute
  // values when serializing, so editing the serialized string could turn the
  // rest of this title into markup.
  render(
    <UnstyledRawHTML html='<a href="https://ocw.mit.edu" title="x> <img src=x onerror=alert(1)>">OCW</a>' />,
  )
  const raw = screen.getByTestId("raw")
  expect(raw.querySelector("[onerror]")).toBeNull()
  expect(screen.getByRole("link", { name: "OCW" })).toHaveAttribute(
    "target",
    "_blank",
  )
})
