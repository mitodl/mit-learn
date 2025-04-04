import { screen } from "@testing-library/react"
import user from "@testing-library/user-event"
import { ListCard } from "./ListCard"
import React from "react"
import invariant from "tiny-invariant"
import { renderWithTheme } from "../../test-utils"

describe("ListCard", () => {
  test("has class MitListCard-root on root element", () => {
    const { container } = renderWithTheme(
      <ListCard className="Foo">
        <ListCard.Content>Hello world</ListCard.Content>
      </ListCard>,
    )
    const card = container.firstChild

    expect(card).toHaveClass("MitListCard-root")
    expect(card).toHaveClass("Foo")
  })

  test.each([
    { forwardClicksToLink: true, finalHref: "#woof" },
    { forwardClicksToLink: false, finalHref: "" },
  ])(
    "The whole card is clickable as a link",
    async ({ forwardClicksToLink, finalHref }) => {
      const href = "#woof"
      renderWithTheme(
        <ListCard forwardClicksToLink={forwardClicksToLink}>
          <ListCard.Title href={href}>Title</ListCard.Title>
          <ListCard.Info>Info</ListCard.Info>
          <ListCard.Footer>Footer</ListCard.Footer>
          <ListCard.Actions>Actions</ListCard.Actions>
        </ListCard>,
      )
      // outermost wrapper is not actually clickable
      const card = document.querySelector(".MitListCard-root > *")
      invariant(card instanceof HTMLDivElement) // Sanity: Chceck it's not an anchor

      await user.click(card)
      expect(window.location.hash).toBe(finalHref)
    },
  )

  test.each([
    { forwardClicksToLink: true, finalHref: "#meow" },
    { forwardClicksToLink: false, finalHref: "" },
  ])(
    "The whole card is clickable as a link when using Content, except buttons and links",
    async ({ forwardClicksToLink, finalHref }) => {
      const onClick = jest.fn()
      const href = "#meow"
      renderWithTheme(
        <ListCard forwardClicksToLink={forwardClicksToLink}>
          <ListCard.Content>
            <div>Hello!</div>
            <button onClick={onClick}>Button</button>
            <a data-card-link="true" href={href}>
              Link
            </a>
          </ListCard.Content>
        </ListCard>,
      )
      const button = screen.getByRole("button", { name: "Button" })
      await user.click(button)
      expect(onClick).toHaveBeenCalled()
      expect(window.location.hash).toBe("")

      // outermost wrapper is not actually clickable
      const card = document.querySelector(".MitListCard-root > *")
      invariant(card instanceof HTMLDivElement) // Sanity: Chceck it's not an anchor

      await user.click(card)
      expect(window.location.hash).toBe(finalHref)
    },
  )

  test("Clicks on interactive elements are not forwarded", async () => {
    const btnOnClick = jest.fn()
    const divOnClick = jest.fn()
    renderWithTheme(
      <ListCard forwardClicksToLink>
        <ListCard.Title href="#one">Title</ListCard.Title>
        <ListCard.Info>Info</ListCard.Info>
        <ListCard.Footer>
          <button onClick={btnOnClick}>Button</button>
          <a href="#two">Link Two</a>
          {/*
          eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
          */}
          <div data-card-action onClick={divOnClick}>
            Interactive Div
          </div>
        </ListCard.Footer>
      </ListCard>,
    )
    const button = screen.getByRole("button", { name: "Button" })
    screen.getByRole("link", { name: "Title" })
    const link2 = screen.getByRole("link", { name: "Link Two" })
    const div = screen.getByText("Interactive Div")
    await user.click(button)
    expect(btnOnClick).toHaveBeenCalled()
    expect(window.location.hash).toBe("")
    await user.click(link2)
    expect(window.location.hash).toBe("#two")
    await user.click(div)
    expect(divOnClick).toHaveBeenCalled()
    expect(window.location.hash).toBe("#two")
  })
})
