import { render, screen } from "@testing-library/react"
import user from "@testing-library/user-event"
import { ListCard } from "./ListCard"
import React from "react"
import { faker } from "@faker-js/faker/locale/en"
import invariant from "tiny-invariant"
import { ThemeProvider } from "../ThemeProvider/ThemeProvider"

describe("ListCard", () => {
  test("has class MitListCard-root on root element", () => {
    const { container } = render(
      <ListCard className="Foo">
        <ListCard.Content>Hello world</ListCard.Content>
      </ListCard>,
      { wrapper: ThemeProvider },
    )
    const card = container.firstChild

    expect(card).toHaveClass("MitListCard-root")
    expect(card).toHaveClass("Foo")
  })

  test("The whole card is clickable as a link", async () => {
    const href = `#${faker.lorem.word()}`
    render(
      <ListCard href={href}>
        <ListCard.Title>Title</ListCard.Title>
        <ListCard.Info>Info</ListCard.Info>
        <ListCard.Footer>Footer</ListCard.Footer>
        <ListCard.Actions>Actions</ListCard.Actions>
      </ListCard>,
      { wrapper: ThemeProvider },
    )
    // outermost wrapper is not actually clickable
    const card = document.querySelector(".MitListCard-root > *")
    invariant(card instanceof HTMLDivElement) // Sanity: Chceck it's not an anchor

    await user.click(card)
    expect(window.location.hash).toBe(href)
  })

  test("The whole card is clickable as a link when using Content, except buttons and links", async () => {
    const href = `#${faker.lorem.word()}`
    const onClick = jest.fn()
    render(
      <ListCard href={href}>
        <ListCard.Content>
          <div>Hello!</div>
          <button onClick={onClick}>Button</button>
          <a href={href}>Link</a>
        </ListCard.Content>
      </ListCard>,
      { wrapper: ThemeProvider },
    )
    const button = screen.getByRole("button", { name: "Button" })
    await user.click(button)
    expect(onClick).toHaveBeenCalled()
    expect(window.location.hash).toBe("")

    // outermost wrapper is not actually clickable
    const card = document.querySelector(".MitListCard-root > *")
    invariant(card instanceof HTMLDivElement) // Sanity: Chceck it's not an anchor

    await user.click(card)
    expect(window.location.hash).toBe(href)
  })
})
