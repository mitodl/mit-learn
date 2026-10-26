import React from "react"
import type { Meta, StoryObj } from "@storybook/nextjs"
import {
  RiBookmarkFill,
  RiBookmarkLine,
  RiFileCopy2Line,
  RiListCheck3,
  RiMenuAddLine,
} from "@remixicon/react"
import { styled } from "ol-components"
import { ResourceCardSkeleton, ResourceCardView } from "./ResourceCardView"
import type {
  CardAction,
  PricePanel,
  ResourceCardViewProps,
} from "./ResourceCardView"

const title = "Introduction to Computer Science and Programming in Python"
const longTitle =
  "Supply Chain Analytics, Design, and Dynamics: Fundamentals of Modeling, Optimization, and Planning Under Uncertainty"

const makeActions = (
  cardTitle: string,
  { bookmarked = false, inLearningPath = false } = {},
): CardAction[] => [
  {
    label: inLearningPath
      ? `In Learning Path: ${cardTitle}`
      : `Add to Learning Path: ${cardTitle}`,
    filled: inLearningPath,
    icon: inLearningPath ? (
      <RiListCheck3 aria-hidden />
    ) : (
      <RiMenuAddLine aria-hidden />
    ),
    onClick: () => {},
  },
  {
    label: bookmarked ? `Bookmarked: ${cardTitle}` : `Bookmark: ${cardTitle}`,
    filled: bookmarked,
    icon: bookmarked ? (
      <RiBookmarkFill aria-hidden />
    ) : (
      <RiBookmarkLine aria-hidden />
    ),
    onClick: () => {},
  },
]

const PRICES: Record<string, PricePanel> = {
  Paid: {
    tone: "dark",
    primary: "$3,750",
    certificate: "Professional Certificate",
  },
  "Free to audit": {
    tone: "light",
    primary: "Free to audit",
    certificate: "Certificate: $50",
  },
  "Free, open license": {
    tone: "light",
    primary: "Free",
    license: "Open license",
  },
  Free: { tone: "light", primary: "Free" },
  "No price": { tone: "neutral" },
}

const LONG_RANGES: Record<string, PricePanel> = {
  "Paid range": {
    tone: "dark",
    primary: "$12,500 – $35,000",
    certificate: "Professional Certificate",
  },
  "Free to audit, certificate range": {
    tone: "light",
    primary: "Free to audit",
    certificate: "Certificate: $1,250 – $3,500",
  },
}

const meta: Meta<ResourceCardViewProps> = {
  title: "smoot-design/Cards/ResourceCardView",
  component: ResourceCardView,
  argTypes: {
    onLinkClick: { action: "click-link" },
  },
  args: {
    title,
    typeLabel: "Course",
    parentCourseName: "Computer Science Foundations",
    imageSrc: "/mit-dome-2.jpg",
    metadata: [
      { label: "Starts", value: "Sep 30, 2026" },
      { label: "Format", value: "Online" },
    ],
    price: PRICES["Free to audit"],
    lang: "en",
    layout: "vertical",
    size: "medium",
    href: "#",
    actions: makeActions(title),
    headingLevel: 3,
  },
}

export default meta

type Story = StoryObj<ResourceCardViewProps>

export const Card: Story = {}

const Section = styled.section({
  display: "flex",
  flexDirection: "column",
  gap: "16px",
  marginBottom: "40px",
})

const Row = styled.div({
  display: "flex",
  flexWrap: "wrap",
  gap: "16px",
})

const Column = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "16px",
})

const FillGrid = styled.div({
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, 220px)",
  gap: "16px",
})

const variants = (
  args: ResourceCardViewProps,
  prices: Record<string, PricePanel>,
): ResourceCardViewProps[] =>
  Object.entries(prices).map(([name, price], i) => ({
    ...args,
    title: `${name}: ${args.title}`,
    price,
    imageSrc: ["/mit-dome-2.jpg", "/person_with_headphones.png"][i % 2],
    metadata:
      price.license !== undefined
        ? [
            { label: "Starts", value: "Anytime" },
            { label: "Format", value: "Online" },
          ]
        : args.metadata,
  }))

const edgeCases = (args: ResourceCardViewProps): ResourceCardViewProps[] => [
  { ...args, title: longTitle, actions: makeActions(longTitle) },
  ...variants(args, LONG_RANGES),
  { ...args, title: `No image: ${args.title}`, imageSrc: null },
  {
    ...args,
    title: `Document, no image: ${args.title}`,
    typeLabel: "Open Textbooks",
    imageSrc: null,
    placeholderIcon: <RiFileCopy2Line />,
    price: PRICES.Free,
  },
  {
    ...args,
    title: `One action: ${args.title}`,
    price: PRICES.Paid,
    actions: makeActions(args.title).slice(1),
  },
  { ...args, title: `No actions: ${args.title}`, actions: [] },
  {
    ...args,
    title: `Bookmarked, in learning path: ${args.title}`,
    actions: makeActions(args.title, {
      bookmarked: true,
      inLearningPath: true,
    }),
  },
  {
    ...args,
    title: `No parent, no metadata: ${args.title}`,
    parentCourseName: undefined,
    metadata: [],
    price: PRICES.Paid,
  },
]

/**
 * Every price state in each layout and size, then edge cases: a long title,
 * long price ranges, no image (with and without a placeholder icon), one or no
 * actions, filled actions, and no metadata.
 */
export const Omnibus: Story = {
  parameters: { layout: "padded" },
  render: (args: ResourceCardViewProps) => {
    const cards = variants(args, PRICES)
    const edges = edgeCases(args)
    const responsive = (width: number, list: ResourceCardViewProps[]) => (
      <Column style={{ width }}>
        {list.map((props) => (
          <ResourceCardView
            key={props.title}
            {...props}
            layout="responsive"
            size={undefined}
          />
        ))}
      </Column>
    )
    const vertical = (
      size: "small" | "medium",
      list: ResourceCardViewProps[],
    ) => (
      <Row>
        {list.map((props) => (
          <ResourceCardView
            key={props.title}
            {...props}
            layout="vertical"
            size={size}
          />
        ))}
      </Row>
    )
    return (
      <>
        <Section>
          <h2>Responsive, 948px container</h2>
          {responsive(948, cards)}
        </Section>
        <Section>
          <h2>Responsive, 343px container</h2>
          {responsive(343, cards)}
        </Section>
        <Section>
          <h2>Vertical, medium</h2>
          {vertical("medium", cards)}
        </Section>
        <Section>
          <h2>Vertical, small</h2>
          {vertical("small", cards)}
        </Section>
        <Section>
          <h2>Vertical, fill (220px grid cells)</h2>
          <FillGrid>
            {cards.map((props) => (
              <ResourceCardView
                key={props.title}
                {...props}
                layout="vertical"
                size={undefined}
              />
            ))}
          </FillGrid>
        </Section>
        <Section>
          <h2>Edge cases, responsive at 948px</h2>
          {responsive(948, edges)}
        </Section>
        <Section>
          <h2>Edge cases, vertical medium</h2>
          {vertical("medium", edges)}
        </Section>
        <Section>
          <h2>Edge cases, vertical small</h2>
          {vertical("small", edges)}
        </Section>
      </>
    )
  },
}

export const SkeletonVertical: Story = {
  render: () => (
    <Row>
      <ResourceCardSkeleton layout="vertical" size="small" />
      <ResourceCardSkeleton layout="vertical" size="medium" />
    </Row>
  ),
}

export const SkeletonResponsive: Story = {
  render: () => (
    <Row>
      <Column style={{ width: 948 }}>
        <ResourceCardSkeleton layout="responsive" />
      </Column>
      <Column style={{ width: 343 }}>
        <ResourceCardSkeleton layout="responsive" />
      </Column>
    </Row>
  ),
}
