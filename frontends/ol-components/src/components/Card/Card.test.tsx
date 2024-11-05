import { render, screen } from "@testing-library/react"
import user from "@testing-library/user-event"
import { Card } from "./Card"
import React from "react"
import { getOriginalSrc } from "ol-test-utilities"
import invariant from "tiny-invariant"
import { ThemeProvider } from "../ThemeProvider/ThemeProvider"

describe("Card", () => {
  test("has class MitCard-root on root element", () => {
    const { container } = render(
      <Card className="Foo">
        <Card.Title>Title</Card.Title>
        <Card.Image src="https://via.placeholder.com/150" alt="placeholder" />
        <Card.Info>Info</Card.Info>
        <Card.Footer>Footer</Card.Footer>
        <Card.Actions>Actions</Card.Actions>
      </Card>,
      { wrapper: ThemeProvider },
    )
    const card = container.firstChild as HTMLElement
    const title = card.querySelector(".MitCard-title")
    const image = card.querySelector<HTMLImageElement>(".MitCard-image")
    const info = card.querySelector(".MitCard-info")
    const footer = card.querySelector(".MitCard-footer")
    const actions = card.querySelector(".MitCard-actions")
    invariant(card)
    invariant(title)
    invariant(image)
    invariant(info)
    invariant(footer)
    invariant(actions)

    expect(card).toHaveClass("MitCard-root")
    expect(card).toHaveClass("Foo")
    expect(title).toHaveTextContent("Title")
    expect(getOriginalSrc(image)).toBe("https://via.placeholder.com/150")
    expect(image).toHaveAttribute("alt", "placeholder")
    expect(info).toHaveTextContent("Info")
    expect(footer).toHaveTextContent("Footer")
    expect(actions).toHaveTextContent("Actions")
  })

  test.each([
    { forwardClicksToLink: true, finalHref: "#woof" },
    { forwardClicksToLink: false, finalHref: "" },
  ])(
    "The whole card is clickable as a link if forwardClicksToLink ($forwardClicksToLink)",
    async ({ forwardClicksToLink, finalHref }) => {
      render(
        <Card forwardClicksToLink={forwardClicksToLink}>
          <Card.Title href="#woof">Title</Card.Title>
          <Card.Image src="https://via.placeholder.com/150" alt="placeholder" />
          <Card.Info>Info</Card.Info>
          <Card.Footer>Footer</Card.Footer>
          <Card.Actions>Actions</Card.Actions>
        </Card>,
        { wrapper: ThemeProvider },
      )
      const card = document.querySelector(".MitCard-root")
      invariant(card instanceof HTMLDivElement) // Sanity: Chceck it's not an anchor

      await user.click(card)
      expect(window.location.hash).toBe(finalHref)
    },
  )

  test.each([
    { forwardClicksToLink: true, finalHref: "#meow" },
    { forwardClicksToLink: false, finalHref: "" },
  ])(
    "The whole card is clickable as a link when using Content when forwardClicksToLink ($forwardClicksToLink), except buttons and links",
    async ({ finalHref, forwardClicksToLink }) => {
      const href = "#meow"
      const onClick = jest.fn()
      render(
        <Card forwardClicksToLink={forwardClicksToLink}>
          <Card.Content>
            <div>Hello!</div>
            <div data-card-actions>
              <button onClick={onClick}>Button</button>
            </div>
            <a data-card-link="true" href={href}>
              Link
            </a>
          </Card.Content>
        </Card>,
        { wrapper: ThemeProvider },
      )
      const button = screen.getByRole("button", { name: "Button" })
      await user.click(button)
      expect(onClick).toHaveBeenCalled()
      expect(window.location.hash).toBe("")

      // outermost wrapper is not actually clickable
      const card = document.querySelector(".MitCard-root")
      invariant(card instanceof HTMLDivElement) // Sanity: Chceck it's not an anchor

      await user.click(card)
      expect(window.location.hash).toBe(finalHref)
    },
  )

  test("Clicks on interactive elements are not forwarded", async () => {
    const btnOnClick = jest.fn()
    const divOnClick = jest.fn()
    render(
      <Card forwardClicksToLink>
        <Card.Title href="#one">Title</Card.Title>
        <Card.Image src="https://via.placeholder.com/150" alt="placeholder" />
        <Card.Info>Info</Card.Info>
        <Card.Footer>
          <button onClick={btnOnClick}>Button</button>
          <a href="#two">Link Two</a>
          {/*
          eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
          */}
          <div data-card-action onClick={divOnClick}>
            Interactive Div
          </div>
        </Card.Footer>
      </Card>,
      { wrapper: ThemeProvider },
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
