import { NavData, NavDrawer } from "./NavDrawer"
import { render, screen } from "@testing-library/react"
import user from "@testing-library/user-event"
import React from "react"
import { ThemeProvider } from "../ThemeProvider/ThemeProvider"

describe("NavDrawer", () => {
  it("Renders the expected drawer contents", () => {
    const navData: NavData = {
      sections: [
        {
          title: "TEST",
          items: [
            {
              title: "Link and description with icon",
              icon: "/path/to/image.svg",
              description: "This item has a link, description and icon",
              href: "https://mit.edu",
            },
            {
              title: "Link and description",
              description: "This item has a link and a description",
              href: "https://mit.edu",
            },
            {
              title: "Link but no description",
              href: "https://ocw.mit.edu",
            },
          ],
        },
      ],
    }
    render(<NavDrawer onClose={jest.fn()} navdata={navData} open={true} />, {
      wrapper: ThemeProvider,
    })
    const links = screen.getAllByTestId("nav-link")
    const icons = screen.getAllByTestId("nav-link-icon")
    const titles = screen.getAllByTestId("nav-link-text")
    const descriptions = screen.getAllByTestId("nav-link-description")
    expect(links).toHaveLength(3)
    expect(icons).toHaveLength(1)
    expect(titles).toHaveLength(3)
    expect(descriptions).toHaveLength(2)
  })

  const NAV_DATA: NavData = {
    sections: [
      {
        title: "TEST 1",
        items: [
          {
            title: "Title 1",
            description: "Description 1",
            href: "https://link.one",
          },
        ],
      },
      {
        title: "TEST 2",
        items: [
          {
            title: "Title 2",
            description: "Description 2",
            href: "https://link.two",
          },
        ],
      },
    ],
  }

  test("close button calls onClose", async () => {
    const onClose = jest.fn()
    render(<NavDrawer onClose={onClose} navdata={NAV_DATA} open={true} />, {
      wrapper: ThemeProvider,
    })
    const close = screen.getByRole("button", { name: "Close Navigation" })
    await user.click(close)
    expect(onClose).toHaveBeenCalled()
  })

  test("escape calls onClose", async () => {
    const onClose = jest.fn()
    render(<NavDrawer onClose={onClose} navdata={NAV_DATA} open={true} />, {
      wrapper: ThemeProvider,
    })
    const links = screen.getAllByRole("link")
    links[0].focus()
    await user.keyboard("{Escape}")
    expect(onClose).toHaveBeenCalled()
  })

  test("click away calls onClose", async () => {
    const onClose = jest.fn()
    render(
      <div>
        <NavDrawer onClose={onClose} navdata={NAV_DATA} open={true} />
        <button type="button">Outside</button>
      </div>,
      {
        wrapper: ThemeProvider,
      },
    )
    await user.click(screen.getByRole("button", { name: "Outside" }))
    expect(onClose).toHaveBeenCalled()
  })
})
