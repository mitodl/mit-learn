import React from "react"
import { screen } from "@testing-library/react"
import user from "@testing-library/user-event"
import { SimpleMenu } from "./SimpleMenu"
import type { SimpleMenuItem } from "./SimpleMenu"
import type { LinkProps } from "react-router-dom"
import { renderWithTheme } from "../../test-utils"

// Mock react-router-dom's Link so we don't need to set up a Router
jest.mock("next/link", () => {
  return {
    __esModule: true,
    default: React.forwardRef<HTMLAnchorElement, LinkProps>(
      jest.fn(({ children, ...props }, ref) => {
        return (
          <a {...props} ref={ref} data-react-component="next/link">
            {children}
          </a>
        )
      }),
    ),
  }
})

describe("SimpleMenu", () => {
  it("Opens the menu when trigger is clicked", async () => {
    const items: SimpleMenuItem[] = [
      { key: "one", label: "Item 1", onClick: jest.fn() },
      { key: "two", label: "Item 2", onClick: jest.fn() },
    ]

    renderWithTheme(
      <SimpleMenu trigger={<button>Open Menu</button>} items={items} />,
    )

    expect(screen.queryByRole("menu")).toBe(null)
    await user.click(screen.getByRole("button", { name: "Open Menu" }))
    expect(screen.queryByRole("menu")).not.toBe(null)
  })

  it("Calls the menuitem's event andler when clicked and closes menu", async () => {
    const items: SimpleMenuItem[] = [
      { key: "one", label: "Item 1", onClick: jest.fn() },
      { key: "two", label: "Item 2", onClick: jest.fn() },
    ]

    renderWithTheme(
      <SimpleMenu trigger={<button>Open Menu</button>} items={items} />,
    )
    await user.click(screen.getByRole("button", { name: "Open Menu" }))
    const menu = screen.getByRole("menu")

    await user.click(screen.getByRole("menuitem", { name: "Item 1" }))
    expect(items[0].onClick).toHaveBeenCalled()
    expect(items[1].onClick).not.toHaveBeenCalled()

    expect(menu).not.toBeInTheDocument()
  })

  it("Calls the trigger's event handler when clicked, in addition to opening the menu", async () => {
    const items: SimpleMenuItem[] = [
      { key: "one", label: "Item 1", onClick: jest.fn() },
      { key: "two", label: "Item 2", onClick: jest.fn() },
    ]

    const triggerHandler = jest.fn()
    renderWithTheme(
      <SimpleMenu
        trigger={<button onClick={triggerHandler}>Open Menu</button>}
        items={items}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Open Menu" }))
    const menu = screen.getByRole("menu")
    expect(menu).toBeVisible()
    expect(triggerHandler).toHaveBeenCalled()
  })

  it("Calls onVisibilityChange when menu opens/closes", async () => {
    const items: SimpleMenuItem[] = [
      { key: "one", label: "Item 1", onClick: jest.fn() },
      { key: "two", label: "Item 2", onClick: jest.fn() },
    ]

    const visibilityHandler = jest.fn()
    renderWithTheme(
      <SimpleMenu
        onVisibilityChange={visibilityHandler}
        trigger={<button>Open Menu</button>}
        items={items}
      />,
    )

    expect(visibilityHandler).not.toHaveBeenCalled()
    await user.click(screen.getByRole("button", { name: "Open Menu" }))
    expect(visibilityHandler).toHaveBeenCalledTimes(1)
    expect(visibilityHandler).toHaveBeenCalledWith(true)

    visibilityHandler.mockClear()

    await user.click(screen.getByRole("menuitem", { name: "Item 1" }))
    expect(visibilityHandler).toHaveBeenCalledTimes(1)
    expect(visibilityHandler).toHaveBeenCalledWith(false)

    visibilityHandler.mockClear()
  })

  it("Renders link items using link", async () => {
    const items: SimpleMenuItem[] = [
      { key: "one", label: "Item 1", onClick: jest.fn() },
      { key: "two", label: "Item 2", href: "./woof" },
    ]

    renderWithTheme(
      <SimpleMenu trigger={<button>Open Menu</button>} items={items} />,
    )
    await user.click(screen.getByRole("button", { name: "Open Menu" }))
    const item2 = screen.getByRole("menuitem", { name: "Item 2" })
    expect(item2.dataset.reactComponent).toBe("next/link")
    expect(item2).toHaveAttribute("href", "./woof")
  })

  it("Renders link with custom LinkComponent if specified", async () => {
    const LinkComponent = React.forwardRef<
      HTMLAnchorElement,
      { href: string; children: React.ReactNode }
    >(({ children, href }, ref) => {
      return (
        <a href={href} ref={ref} data-react-component="custom-link">
          {children}
        </a>
      )
    })
    const items: SimpleMenuItem[] = [
      { key: "one", label: "Item 1", onClick: jest.fn() },
      { key: "two", label: "Item 2", href: "./woof", LinkComponent },
    ]

    renderWithTheme(
      <SimpleMenu trigger={<button>Open Menu</button>} items={items} />,
    )
    await user.click(screen.getByRole("button", { name: "Open Menu" }))
    const item2 = screen.getByRole("link", { name: "Item 2" })
    expect(item2.dataset.reactComponent).toBe("custom-link")
    expect((item2 as HTMLAnchorElement).href).toBe(`${window.origin}/woof`)
  })
})
