import { render } from "@testing-library/react"
import { Card } from "./Card"
import React from "react"
import { getOriginalSrc } from "ol-test-utilities"
import invariant from "tiny-invariant"

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
})
