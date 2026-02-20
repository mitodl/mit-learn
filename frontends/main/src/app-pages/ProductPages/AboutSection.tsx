import React from "react"
import { UnderlinedLink } from "./ProductSummary"
import { HeadingIds } from "./util"
import RawHTML from "./RawHTML"
import { Typography } from "ol-components"
import { styled } from "@mitodl/smoot-design"
import type { ProductNoun } from "./util"

const AboutSectionRoot = styled.section<{ expanded: boolean }>(
  ({ expanded }) => {
    return [
      {
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        /**
         * Note: browser suppport for ':has' is decent but not universal.
         * At worst, users will see show more/less link when they shouldn't.
         */
        "&:has(.raw-html > *:only-child)": {
          "& .show-more-less": {
            display: "none",
          },
        },
      },
      !expanded && {
        ".raw-html > *:not(:first-child)": {
          display: "none",
        },
      },
    ]
  },
)

const AboutSection: React.FC<{
  aboutHtml: string
  productNoun: ProductNoun
}> = ({ aboutHtml, productNoun }) => {
  const [aboutExpanded, setAboutExpanded] = React.useState(false)
  return (
    <AboutSectionRoot
      expanded={aboutExpanded}
      aria-labelledby={HeadingIds.About}
    >
      <Typography variant="h3" component="h2" id={HeadingIds.About}>
        About this {productNoun}
      </Typography>
      <RawHTML html={aboutHtml} />
      <UnderlinedLink
        href=""
        color="red"
        role="button"
        className="show-more-less"
        onClick={(e) => {
          e.preventDefault()
          setAboutExpanded((curr) => !curr)
        }}
      >
        {aboutExpanded ? "Show less" : "Show more"}
      </UnderlinedLink>
    </AboutSectionRoot>
  )
}

export default AboutSection
