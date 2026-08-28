"use client"

import React from "react"
import { styled, theme } from "ol-components"
import { RiCheckLine } from "@remixicon/react"
import { ORGANIZATIONAL_LEARNING_FORM_ID } from "@/common/urls"
import OrgLeadForm from "./OrgLeadForm"
import { Section, SectionInner } from "./SectionLayout"
import { getInTouch as copy } from "./copy"

const DarkSection = styled(Section)(({ theme }) => ({
  backgroundColor: theme.custom.colors.darkGray2,
  "&:focus-visible": {
    outline: `2px solid ${theme.custom.colors.red}`,
    outlineOffset: "-2px",
  },
}))

const Inner = styled(SectionInner)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: "48px",
  padding: "120px 24px",
  [theme.breakpoints.down("lg")]: {
    alignItems: "stretch",
    flexDirection: "column",
    padding: "48px 24px",
  },
  [theme.breakpoints.down("md")]: {
    padding: "32px 24px",
    gap: "32px",
  },
}))

const Intro = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: "48px",
  flex: "0 0 476px",
  [theme.breakpoints.down("lg")]: {
    flex: "initial",
  },
  [theme.breakpoints.down("md")]: {
    gap: "32px",
  },
}))

const Heading = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "24px",
})

const Eyebrow = styled.p(({ theme }) => ({
  ...theme.typography.subtitle2,
  fontWeight: theme.typography.fontWeightBold,
  color: theme.custom.colors.silverGray,
  margin: 0,
}))

const Title = styled.h2(({ theme }) => ({
  ...theme.typography.h2,
  color: theme.custom.colors.white,
  margin: 0,
  [theme.breakpoints.down("md")]: {
    ...theme.typography.h3,
  },
}))

const Pitch = styled.div(({ theme }) => ({
  backgroundColor: theme.custom.colors.black,
  borderLeft: `1px solid ${theme.custom.colors.red}`,
  padding: "32px",
  [theme.breakpoints.down("md")]: {
    padding: "24px",
  },
}))

const PitchText = styled.p(({ theme }) => ({
  ...theme.typography.h5,
  color: theme.custom.colors.white,
  margin: 0,
}))

const Assurances = styled.ul({
  display: "flex",
  flexDirection: "column",
  gap: "24px",
  listStyle: "none",
  margin: 0,
  padding: 0,
})

const Assurance = styled.li({
  display: "flex",
  alignItems: "center",
  gap: "12px",
})

const AssuranceIcon = styled(RiCheckLine)({
  color: theme.custom.colors.green,
  flexShrink: 0,
  width: "24px",
  height: "24px",
})

const AssuranceText = styled.span(({ theme }) => ({
  ...theme.typography.body1,
  color: theme.custom.colors.white,
}))

const FormColumn = styled.div({
  flex: "1 1 0",
  minWidth: 0,
})

const GetInTouchSection: React.FC = () => (
  <DarkSection
    id={ORGANIZATIONAL_LEARNING_FORM_ID}
    aria-labelledby="get-in-touch-heading"
  >
    <Inner>
      <Intro>
        <Heading>
          <Eyebrow>{copy.eyebrow}</Eyebrow>
          <Title id="get-in-touch-heading">{copy.title}</Title>
        </Heading>
        <Pitch>
          <PitchText>{copy.pitch}</PitchText>
        </Pitch>
        <Assurances>
          {copy.assurances.map((assurance) => (
            <Assurance key={assurance}>
              <AssuranceIcon aria-hidden />
              <AssuranceText>{assurance}</AssuranceText>
            </Assurance>
          ))}
        </Assurances>
      </Intro>
      <FormColumn>
        <OrgLeadForm />
      </FormColumn>
    </Inner>
  </DarkSection>
)

export default GetInTouchSection
