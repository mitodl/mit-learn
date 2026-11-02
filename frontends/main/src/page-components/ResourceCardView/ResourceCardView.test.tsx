import React from "react"
import { faker } from "@faker-js/faker/locale/en"
import escapeRegExp from "lodash/escapeRegExp"
import { DEFAULT_RESOURCE_IMG } from "ol-utilities"
import { getByImageSrc, queryByImageSrc } from "ol-test-utilities"
import { renderWithTheme, screen, user, within } from "@/test-utils"
import { ResourceCardView } from "./ResourceCardView"
import type { CardLayoutProps, ResourceCardViewProps } from "./ResourceCardView"

const makeProps = (): ResourceCardViewProps => {
  const title = faker.lorem.words(3)
  return {
    title,
    typeLabel: faker.lorem.word(),
    parentCourseName: faker.lorem.words(2),
    imageSrc: faker.image.url(),
    metadata: [
      { label: faker.lorem.word(), value: faker.lorem.words(2) },
      {
        label: faker.lorem.word(),
        value: faker.lorem.words(2),
      },
    ],
    price: {
      tone: "dark",
      primary: faker.lorem.words(2),
      certificate: faker.lorem.words(2),
      license: faker.lorem.words(2),
    },
    lang: faker.helpers.arrayElement(["en", "fr", "es"]),
    layout: "vertical",
    size: "medium",
    href: `/${faker.lorem.slug()}`,
    pushUrl: `?resource=${faker.number.int()}`,
    onLinkClick: jest.fn(),
    actions: [
      {
        label: faker.lorem.sentence(),
        filled: false,
        icon: <span aria-hidden />,
        onClick: jest.fn(),
      },
      {
        label: faker.lorem.sentence(),
        filled: true,
        icon: <span aria-hidden />,
        onClick: jest.fn(),
      },
    ],
    headingLevel: faker.helpers.arrayElement([2, 3, 4, 5, 6] as const),
    className: faker.lorem.word(),
  }
}

describe("ResourceCardView", () => {
  test("The title is a link inside a heading of the given level and language", async () => {
    const props = makeProps()
    renderWithTheme(<ResourceCardView {...props} />)
    const heading = screen.getByRole("heading", {
      level: props.headingLevel,
      name: props.title,
    })
    expect(heading).toHaveAttribute("lang", props.lang)
    const link = within(heading).getByRole("link", { name: props.title })
    expect(link).toHaveAttribute("href", props.href)
    await user.click(link)
    expect(props.onLinkClick).toHaveBeenCalledTimes(1)
  })

  test("The link is described by the type, parent, metadata, and price, but not the actions", () => {
    const props = makeProps()
    renderWithTheme(<ResourceCardView {...props} />)
    const link = screen.getByRole("link", { name: props.title })
    const inOrder = [
      props.typeLabel,
      `From ${props.parentCourseName}`,
      ...props.metadata.flatMap(({ label, value }) => [label, String(value)]),
      props.price.primary,
      props.price.certificate,
      props.price.license,
    ]
      .map((text) => escapeRegExp(text))
      .join(".*")
    expect(link).toHaveAccessibleDescription(new RegExp(inOrder))
    props.actions.forEach(({ label }) => {
      expect(link).not.toHaveAccessibleDescription(
        new RegExp(escapeRegExp(label)),
      )
    })
  })

  test("Metadata is a description list of div-wrapped term/definition pairs", () => {
    const props = makeProps()
    renderWithTheme(<ResourceCardView {...props} />)
    const dl = screen.getAllByRole("term")[0].closest("dl")
    const groups = Array.from(dl?.children ?? [])
    expect(groups).toHaveLength(props.metadata.length)
    groups.forEach((group, i) => {
      expect(group.tagName).toBe("DIV")
      expect(Array.from(group.children).map((el) => el.tagName)).toEqual([
        "DT",
        "DD",
      ])
      expect(group.children[0]).toHaveTextContent(`${props.metadata[i].label}:`)
    })
  })

  test("Actions are dialog-opening buttons, in order, after the price panel", async () => {
    const props = makeProps()
    renderWithTheme(<ResourceCardView {...props} />)
    const buttons = props.actions.map(({ label }) =>
      screen.getByRole("button", { name: label }),
    )
    expect(screen.getAllByRole("button")).toEqual(buttons)
    const link = screen.getByRole("link", { name: props.title })
    const panelId = link.getAttribute("aria-describedby")!.split(" ").at(-1)!
    const panel = document.getElementById(panelId)!
    expect(panel).toHaveTextContent(props.price.primary!)
    expect(within(panel).queryAllByRole("button")).toEqual([])
    for (const [i, button] of buttons.entries()) {
      expect(button).toHaveAttribute("aria-haspopup", "dialog")
      expect(
        panel.compareDocumentPosition(button) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy()
      await user.click(button)
      expect(props.actions[i].onClick).toHaveBeenCalledTimes(1)
    }
    expect(props.onLinkClick).not.toHaveBeenCalled()
  })

  test.each([
    { tone: "dark", hasIcon: true },
    { tone: "light", hasIcon: false },
  ] as const)(
    "The certificate line on a $tone panel has an award icon: $hasIcon",
    ({ tone, hasIcon }) => {
      const props = makeProps()
      renderWithTheme(
        <ResourceCardView {...props} price={{ ...props.price, tone }} />,
      )
      const line = screen.getByText(props.price.certificate!)
      expect(line.querySelector("svg") !== null).toBe(hasIcon)
    },
  )

  test("Without a parent course, no 'From' line renders", () => {
    const { parentCourseName: _, ...props } = makeProps()
    renderWithTheme(<ResourceCardView {...props} />)
    expect(screen.queryByText(/^From\b/)).toBeNull()
  })

  test("The image is decorative and falls back to the default image", () => {
    const props = makeProps()
    const { container, rerender } = renderWithTheme(
      <ResourceCardView {...props} />,
    )
    expect(getByImageSrc(container, props.imageSrc!)).toHaveAttribute("alt", "")
    rerender(<ResourceCardView {...props} imageSrc={null} />)
    expect(getByImageSrc(container, DEFAULT_RESOURCE_IMG)).toHaveAttribute(
      "alt",
      "",
    )
  })

  test.each<{ name: string; layoutProps: CardLayoutProps; sizes: string }>([
    {
      name: "small",
      layoutProps: { layout: "vertical", size: "small" },
      sizes: "190px",
    },
    {
      name: "fluid",
      layoutProps: { layout: "responsive" },
      sizes: "(max-width: 600px) 100vw, 600px",
    },
  ])(
    "A $name card's image advertises sizes $sizes",
    ({ layoutProps, sizes }) => {
      const { layout: _layout, size: _size, ...props } = makeProps()
      const { container } = renderWithTheme(
        <ResourceCardView {...props} {...layoutProps} />,
      )
      expect(getByImageSrc(container, props.imageSrc!)).toHaveAttribute(
        "sizes",
        sizes,
      )
    },
  )

  test("A placeholder icon replaces the default image, but not a real one", () => {
    const props = makeProps()
    const icon = <svg data-testid="placeholder" />
    const { container, rerender } = renderWithTheme(
      <ResourceCardView {...props} placeholderIcon={icon} />,
    )
    expect(getByImageSrc(container, props.imageSrc!)).toBeInTheDocument()
    expect(screen.queryByTestId("placeholder")).toBeNull()
    rerender(
      <ResourceCardView {...props} imageSrc={null} placeholderIcon={icon} />,
    )
    expect(screen.getByTestId("placeholder")).toBeInTheDocument()
    expect(queryByImageSrc(container, DEFAULT_RESOURCE_IMG)).toBeNull()
  })
})
