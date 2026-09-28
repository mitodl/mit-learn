import { screen } from "@testing-library/react"
import user from "@testing-library/user-event"
import { Card } from "./Card"
import React from "react"
import { getOriginalSrc } from "ol-test-utilities"
import invariant from "tiny-invariant"
import { renderWithTheme } from "../../test-utils"

/**
 * jsdom implements no PointerEvent at all, and useClickChildLink constructs one
 * to carry a modifier onto the card's anchor. MouseEvent takes the same init
 * fields, so it stands in for the ones under test here; the gestures a real
 * browser performs in response are out of jsdom's reach either way.
 */
window.PointerEvent = MouseEvent as unknown as typeof PointerEvent

describe("Card", () => {
  test("has class MitCard-root on root element", () => {
    const { container } = renderWithTheme(
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

  test.each([
    { forwardClicksToLink: true, finalHref: "#woof" },
    { forwardClicksToLink: false, finalHref: "" },
  ])(
    "The whole card is clickable as a link if forwardClicksToLink ($forwardClicksToLink)",
    async ({ forwardClicksToLink, finalHref }) => {
      renderWithTheme(
        <Card forwardClicksToLink={forwardClicksToLink}>
          <Card.Title href="#woof">Title</Card.Title>
          <Card.Image src="https://via.placeholder.com/150" alt="placeholder" />
          <Card.Info>Info</Card.Info>
          <Card.Footer>Footer</Card.Footer>
          <Card.Actions>Actions</Card.Actions>
        </Card>,
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
      renderWithTheme(
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
    renderWithTheme(
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

  test("Card title has heading role and aria-level set for screen reader navigation", async () => {
    renderWithTheme(
      <Card>
        <Card.Title role="heading" aria-level={2}>
          Title
        </Card.Title>
      </Card>,
    )
    const titleHeading = screen.getByRole("heading", {
      name: "Title",
    })
    expect(titleHeading.getAttribute("aria-level")).toBe("2")
  })

  /**
   * Regression guard for the card link's pushUrl: a forwarded body click must
   * reach the anchor's React handler, not just its default behavior, or the
   * anchor has no chance to cancel the navigation.
   */
  test("A body click reaches the card link's own React handler", async () => {
    const onClick = jest.fn((e: React.MouseEvent) => e.preventDefault())
    renderWithTheme(
      <Card forwardClicksToLink>
        <Card.Content>
          <a data-card-link="true" href="#woof" onClick={onClick}>
            Title
          </a>
          <div>Body</div>
        </Card.Content>
      </Card>,
    )

    await user.click(screen.getByText("Body"))

    expect(onClick).toHaveBeenCalled()
    expect(window.location.hash).toBe("")
  })

  /**
   * Pins the whole Card.Title -> Linkable -> Link -> LinkAdapter chain, emotion's
   * prop forwarding included. Asserting on window.location instead would not
   * catch a broken chain: pushState and an ordinary hash navigation both leave
   * the same location behind.
   *
   * The second row uses a hash href because jsdom refuses cross-document
   * navigation and console.errors, and ol-components has no
   * expectWindowNavigation.
   */
  test.each([
    {
      name: "pushUrl is forwarded down the chain",
      href: "/search?resource=1",
      pushUrl: "?resource=1",
      pushed: "?resource=1",
    },
    {
      name: "an href with no pushUrl navigates rather than pushing",
      href: "#woof",
      pushUrl: undefined,
      pushed: null,
    },
  ])("Card.Title: $name", async ({ href, pushUrl, pushed }) => {
    const pushState = jest.spyOn(window.history, "pushState")
    renderWithTheme(
      <Card>
        <Card.Title href={href} pushUrl={pushUrl}>
          Title
        </Card.Title>
      </Card>,
    )

    await user.click(screen.getByRole("link", { name: "Title" }))

    if (pushed === null) {
      expect(pushState).not.toHaveBeenCalled()
    } else {
      expect(pushState).toHaveBeenCalledWith({}, "", pushed)
    }
  })

  /**
   * One row per modifier: each is both an operand of the guard and a field of
   * the forwarded event, and omitting it from either turns that gesture into a
   * plain click on the card link. The listener goes on the anchor itself
   * because the forwarded event deliberately does not bubble.
   *
   * jsdom implements none of the gestures these modifiers trigger, so this
   * pins the flags arriving at the anchor, not the new tab or window that a
   * real browser opens in response.
   */
  test.each([
    { modifier: "Meta", flag: "metaKey" },
    { modifier: "Control", flag: "ctrlKey" },
    { modifier: "Shift", flag: "shiftKey" },
    { modifier: "Alt", flag: "altKey" },
  ])(
    "A $modifier-click on the body forwards the modifier to the card link",
    async ({ modifier, flag }) => {
      renderWithTheme(
        <Card forwardClicksToLink>
          <Card.Content>
            <a data-card-link="true" href="#woof">
              Title
            </a>
            <div>Body</div>
          </Card.Content>
        </Card>,
      )
      const forwarded = jest.fn()
      screen.getByRole("link").addEventListener("click", forwarded)
      const u = user.setup()
      await u.keyboard(`{${modifier}>}`)

      await u.click(screen.getByText("Body"))

      expect(forwarded).toHaveBeenCalledTimes(1)
      expect(forwarded.mock.calls[0][0]).toHaveProperty(flag, true)
    },
  )
})
