import { render, screen } from "@testing-library/react"
import user from "@testing-library/user-event"
import { Card } from "./Card"
import React from "react"
import { getOriginalSrc } from "ol-test-utilities"
import invariant from "tiny-invariant"
import { ThemeProvider } from "../ThemeProvider/ThemeProvider"
import { faker } from "@faker-js/faker/locale/en"

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

  test("The whole card is clickable as a link", async () => {
    const href = `#${faker.lorem.word()}`
    render(
      <Card href={href}>
        <Card.Title>Title</Card.Title>
        <Card.Image src="https://via.placeholder.com/150" alt="placeholder" />
        <Card.Info>Info</Card.Info>
        <Card.Footer>Footer</Card.Footer>
        <Card.Actions>Actions</Card.Actions>
      </Card>,
      { wrapper: ThemeProvider },
    )
    // outermost wrapper is not actually clickable
    const card = document.querySelector(".MitCard-root > *")
    invariant(card instanceof HTMLDivElement) // Sanity: Chceck it's not an anchor

    await user.click(card)
    expect(window.location.hash).toBe(href)
  })

  test("The whole card is clickable as a link when using Content, except buttons and links", async () => {
    const href = `#${faker.lorem.word()}`
    const onClick = jest.fn()
    render(
      <Card href={href}>
        <Card.Content>
          <div>Hello!</div>
          <button onClick={onClick}>Button</button>
          <a href={href}>Link</a>
        </Card.Content>
      </Card>,
      { wrapper: ThemeProvider },
    )
    const button = screen.getByRole("button", { name: "Button" })
    await user.click(button)
    expect(onClick).toHaveBeenCalled()
    expect(window.location.hash).toBe("")

    // outermost wrapper is not actually clickable
    const card = document.querySelector(".MitCard-root > *")
    invariant(card instanceof HTMLDivElement) // Sanity: Chceck it's not an anchor

    await user.click(card)
    expect(window.location.hash).toBe(href)
  })
})
