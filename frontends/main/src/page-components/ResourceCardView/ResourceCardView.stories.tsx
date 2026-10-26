import React from "react"
import type { Meta, StoryObj } from "@storybook/nextjs"
import { RiBookmarkLine, RiMenuAddLine } from "@remixicon/react"
import { ResourceCardView } from "./ResourceCardView"
import type { ResourceCardViewProps } from "./ResourceCardView"

const title = "Introduction to Computer Science and Programming in Python"

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
    price: {
      tone: "light",
      primary: "Free to audit",
      certificate: "Certificate: $50 – $150",
    },
    lang: "en",
    layout: "vertical",
    size: "medium",
    href: "#",
    actions: [
      {
        label: `Add to Learning Path: ${title}`,
        filled: false,
        icon: <RiMenuAddLine aria-hidden />,
        onClick: () => {},
      },
      {
        label: `Bookmark: ${title}`,
        filled: false,
        icon: <RiBookmarkLine aria-hidden />,
        onClick: () => {},
      },
    ],
    headingLevel: 3,
  },
}

export default meta

export const Card: StoryObj<ResourceCardViewProps> = {}
