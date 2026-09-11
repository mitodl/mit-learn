"use client"

import React from "react"
import { styled } from "ol-components"
import {
  RiBookOpenLine,
  RiMacbookLine,
  RiTeamLine,
  RiPresentationLine,
  RiIdCardLine,
  RiPagesLine,
} from "@remixicon/react"
import CtaButton from "./CtaButton"
import {
  Section,
  SectionInner,
  SectionEyebrow,
  SectionHeading,
  SectionHeader,
} from "./SectionLayout"
import { deliveryFormats as copy } from "./copy"

const FORMAT_ICONS = [
  RiBookOpenLine,
  RiMacbookLine,
  RiTeamLine,
  RiPresentationLine,
  RiIdCardLine,
  RiPagesLine,
]

const Band = styled(Section)(({ theme }) => ({
  backgroundColor: theme.custom.colors.mitRed,
}))

const Inner = styled(SectionInner)({
  display: "flex",
  flexDirection: "column",
  gap: "56px",
})

const CenteredHeader = styled(SectionHeader)({
  textAlign: "center",
  alignItems: "center",
})

const Eyebrow = styled(SectionEyebrow)(({ theme }) => ({
  color: theme.custom.colors.white,
}))

const Heading = styled(SectionHeading)(({ theme }) => ({
  color: theme.custom.colors.white,
}))

const Formats = styled.ul(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  listStyle: "none",
  margin: 0,
  padding: 0,
  "> li:nth-of-type(3n - 1)": {
    borderLeft: `1px solid ${theme.custom.colors.red}`,
    borderRight: `1px solid ${theme.custom.colors.red}`,
  },
  "> li:nth-of-type(-n + 3)": {
    borderBottom: `1px solid ${theme.custom.colors.red}`,
  },
  [theme.breakpoints.down("md")]: {
    gridTemplateColumns: "1fr",
    "> li:nth-of-type(3n - 1)": {
      borderLeft: "none",
      borderRight: "none",
    },
    "> li:not(:last-of-type)": {
      borderBottom: `1px solid ${theme.custom.colors.red}`,
    },
  },
}))

const Format = styled.li(({ theme }) => ({
  padding: "40px",
  display: "flex",
  flexDirection: "column",
  gap: "24px",
  justifyContent: "center",
  svg: {
    color: theme.custom.colors.white,
    width: "48px",
    height: "48px",
    flexShrink: 0,
  },
  [theme.breakpoints.down("md")]: {
    padding: "24px",
    gap: "16px",
  },
}))

const FormatText = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "8px",
})

const FormatTitle = styled.h3(({ theme }) => ({
  ...theme.typography.h4,
  color: theme.custom.colors.white,
  margin: 0,
}))

const FormatBody = styled.p(({ theme }) => ({
  ...theme.typography.body1,
  color: theme.custom.colors.white,
  margin: 0,
}))

const Actions = styled.div(({ theme }) => ({
  display: "flex",
  justifyContent: "center",
  [theme.breakpoints.down("sm")]: {
    button: { width: "100%" },
  },
}))

const InvertedCta = styled(CtaButton)(({ theme }) => ({
  backgroundColor: theme.custom.colors.white,
  borderColor: theme.custom.colors.white,
  color: theme.custom.colors.mitRed,
  "&:hover:not(:disabled)": {
    backgroundColor: theme.custom.colors.lightGray1,
    borderColor: theme.custom.colors.lightGray1,
    color: theme.custom.colors.mitRed,
  },
}))

const DeliveryFormatsSection: React.FC = () => (
  <Band aria-labelledby="delivery-formats-heading">
    <Inner>
      <CenteredHeader>
        <Eyebrow>{copy.eyebrow}</Eyebrow>
        <Heading id="delivery-formats-heading">{copy.title}</Heading>
      </CenteredHeader>

      <Formats>
        {copy.items.map((item, index) => {
          const Icon = FORMAT_ICONS[index]
          return (
            <Format key={item.title}>
              {Icon ? <Icon aria-hidden /> : null}
              <FormatText>
                <FormatTitle>{item.title}</FormatTitle>
                <FormatBody>{item.body}</FormatBody>
              </FormatText>
            </Format>
          )
        })}
      </Formats>

      <Actions>
        <InvertedCta placement="deliveryFormats" variant="secondary">
          {copy.ctaLabel}
        </InvertedCta>
      </Actions>
    </Inner>
  </Band>
)

export default DeliveryFormatsSection
