import { NavData, NavDrawer } from "./NavDrawer"
import { screen } from "@testing-library/react"
import user from "@testing-library/user-event"
import React from "react"
import Image from "next/image"
import { renderWithTheme } from "../../test-utils"

const mockedPostHogCapture = jest.fn()

jest.mock("posthog-js/react", () => ({
  PostHogProvider: (props: { children: React.ReactNode }) => (
    <div data-testid="phProvider">{props.children}</div>
  ),

  usePostHog: () => {
    return { capture: mockedPostHogCapture }
  },
}))

describe("NavDrawer", () => {
  it("Renders the expected drawer contents", () => {
    const navData: NavData = {
      sections: [
        {
          title: "TEST",
          items: [
            {
              title: "Link and description with icon",
              icon: (
                <Image
                  src="/path/to/image.svg"
                  alt=""
                  width={22}
                  height={22}
                  data-testid="nav-link-icon"
                />
              ),
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
    renderWithTheme(
      <NavDrawer
        onClose={jest.fn()}
        navData={navData}
        open={true}
        posthogCapture={(event: string) => {
          mockedPostHogCapture(event)
        }}
      />,
    )
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
            href: "#hash-1",
            posthogEvent: "test_event_1",
          },
        ],
      },
      {
        title: "TEST 2",
        items: [
          {
            title: "Title 2",
            description: "Description 2",
            href: "#hash-2",
          },
        ],
      },
    ],
  }

  test("close button calls onClose", async () => {
    const onClose = jest.fn()
    renderWithTheme(
      <NavDrawer
        onClose={onClose}
        posthogCapture={(event: string) => {
          mockedPostHogCapture(event)
        }}
        navData={NAV_DATA}
        open={true}
      />,
    )
    const close = screen.getByRole("button", { name: "Close Navigation" })
    await user.click(close)
    expect(onClose).toHaveBeenCalled()
  })

  test("escape calls onClose", async () => {
    const onClose = jest.fn()
    renderWithTheme(
      <NavDrawer
        onClose={onClose}
        posthogCapture={(event: string) => {
          mockedPostHogCapture(event)
        }}
        navData={NAV_DATA}
        open={true}
      />,
    )
    const links = screen.getAllByRole("link")
    links[0].focus()
    await user.keyboard("{Escape}")
    expect(onClose).toHaveBeenCalled()
  })

  test("click away calls onClose if target is not excluded", async () => {
    const onClose = jest.fn()
    const Component = () => {
      const excluded = React.useRef<HTMLButtonElement>(null)
      return (
        <div>
          <NavDrawer
            getClickAwayExcluded={() => [excluded.current]}
            onClose={onClose}
            posthogCapture={(event: string) => {
              mockedPostHogCapture(event)
            }}
            navData={NAV_DATA}
            open={true}
          />
          <button type="button">Outside</button>
          <button ref={excluded} type="button">
            Excluded
            <svg data-testid="foo" />
          </button>
        </div>
      )
    }
    renderWithTheme(<Component />)
    await user.click(screen.getByRole("button", { name: "Outside" }))
    expect(onClose).toHaveBeenCalled()
    onClose.mockReset()

    await user.click(screen.getByRole("button", { name: "Excluded" }))
    await user.click(screen.getByTestId("foo"))
    expect(onClose).not.toHaveBeenCalled()
  })

  test("clicking a link navigates and closes the drawer", async () => {
    const onClose = jest.fn()
    renderWithTheme(
      <NavDrawer
        onClose={onClose}
        posthogCapture={(event: string) => {
          mockedPostHogCapture(event)
        }}
        navData={NAV_DATA}
        open={true}
      />,
    )

    const link = screen.getByRole("link", { name: "Title 1 Description 1" })
    await user.click(link)

    expect(window.location.hash).toBe("#hash-1")
    expect(onClose).toHaveBeenCalled()
  })

  it.each([{ enablePostHog: true }, { enablePostHog: false }])(
    "posthogCapture callback is called only if passed in",
    async ({ enablePostHog }) => {
      process.env.NEXT_PUBLIC_POSTHOG_API_KEY = enablePostHog
        ? "12345abcdef" // pragma: allowlist secret
        : ""
      renderWithTheme(
        <NavDrawer
          onClose={jest.fn()}
          posthogCapture={
            enablePostHog
              ? (event: string) => {
                  mockedPostHogCapture(event)
                }
              : undefined
          }
          navData={NAV_DATA}
          open={true}
        />,
      )

      const link = screen.getByRole("link", { name: "Title 1 Description 1" })
      const link2 = screen.getByRole("link", { name: "Title 2 Description 2" })
      await user.click(link)
      await user.click(link2)

      if (enablePostHog) {
        expect(mockedPostHogCapture).toHaveBeenCalledExactlyOnceWith(
          "test_event_1",
        )
      } else {
        expect(mockedPostHogCapture).not.toHaveBeenCalled()
      }
    },
  )
})
