import React from "react"
import type { NavData } from "ol-components"
import {
  RiPencilRulerLine,
  RiStackLine,
  RiBookMarkedLine,
  RiPresentationLine,
  RiNodeTree,
  RiVerifiedBadgeLine,
  RiFileAddLine,
  RiTimeLine,
  RiPriceTag3Line,
  RiAwardLine,
  RiThumbUpLine,
  RiGlobalLine,
} from "@remixicon/react"
import {
  DEPARTMENTS,
  TOPICS,
  UNITS,
  SEARCH_NEW,
  SEARCH_UPCOMING,
  SEARCH_POPULAR,
  SEARCH_FREE,
  SEARCH_CERTIFICATE,
  SEARCH_COURSE,
  SEARCH_PROGRAM,
  SEARCH_LEARNING_MATERIAL,
  ORGANIZATIONAL_LEARNING,
} from "@/common/urls"
import { PostHogEvents } from "@/common/constants"

/**
 * Contents of the nav drawer, which desktop and mobile share.
 *
 * A function rather than a constant because the "For Organizations" entry is
 * behind a rollout flag, and flags can only be read from a hook inside a
 * component. Keeping it pure means the flag behaviour is testable without
 * mounting the header.
 */
export const buildNavData = (showOrganizationalLearning: boolean): NavData => ({
  sections: [
    {
      title: "LEARN",
      items: [
        {
          title: "Courses",
          icon: <RiPencilRulerLine />,
          description:
            "Single courses on a specific subject, taught by MIT instructors",
          href: SEARCH_COURSE,
          posthogEvent: PostHogEvents.ClickedNavBrowseCourses,
        },
        {
          title: "Programs",
          icon: <RiStackLine />,
          description:
            "A series of courses for in-depth learning across a range of topics",
          href: SEARCH_PROGRAM,
          posthogEvent: PostHogEvents.ClickedNavBrowsePrograms,
        },
        {
          title: "Learning Materials",
          icon: <RiBookMarkedLine />,
          description:
            "Free learning and teaching materials, including videos, podcasts, lecture notes, and more",
          href: SEARCH_LEARNING_MATERIAL,
          posthogEvent: PostHogEvents.ClickedNavBrowseLearningMaterials,
        },
      ],
    },
    {
      title: "BROWSE",
      items: [
        {
          title: "By Topic",
          icon: <RiPresentationLine />,
          href: TOPICS,
          posthogEvent: PostHogEvents.ClickedNavBrowseTopics,
        },
        {
          title: "By Department",
          icon: <RiNodeTree />,
          href: DEPARTMENTS,
          posthogEvent: PostHogEvents.ClickedNavBrowseDepartments,
        },
        {
          title: "By Provider",
          icon: <RiVerifiedBadgeLine />,
          href: UNITS,
          posthogEvent: PostHogEvents.ClickedNavBrowseProviders,
        },
      ],
    },
    {
      title: "DISCOVER LEARNING RESOURCES",
      items: [
        {
          title: "Recently Added",
          icon: <RiFileAddLine />,
          href: SEARCH_NEW,
          posthogEvent: PostHogEvents.ClickedNavBrowseNew,
        },
        {
          title: "Popular",
          href: SEARCH_POPULAR,
          icon: <RiThumbUpLine />,
          posthogEvent: PostHogEvents.ClickedNavBrowsePopular,
        },
        {
          title: "Upcoming",
          icon: <RiTimeLine />,
          href: SEARCH_UPCOMING,
          posthogEvent: PostHogEvents.ClickedNavBrowseUpcoming,
        },
        {
          title: "Free",
          icon: <RiPriceTag3Line />,
          href: SEARCH_FREE,
          posthogEvent: PostHogEvents.ClickedNavBrowseFree,
        },
        {
          title: "With Certificate",
          icon: <RiAwardLine />,
          href: SEARCH_CERTIFICATE,
          posthogEvent: PostHogEvents.ClickedNavBrowseCertificate,
        },
      ],
    },
    /**
     * Last, and deliberately without a section heading — the design separates
     * it from the browse sections with a rule instead. It is a different
     * audience, not another way to browse the catalog.
     */
    ...(showOrganizationalLearning
      ? [
          {
            divider: true,
            items: [
              {
                title: "Organizational Learning",
                icon: <RiGlobalLine />,
                description:
                  "MIT learning programs for businesses, government, and higher education institutions",
                href: ORGANIZATIONAL_LEARNING,
                posthogEvent: PostHogEvents.ClickedNavForOrganizations,
              },
            ],
          },
        ]
      : []),
  ],
})
