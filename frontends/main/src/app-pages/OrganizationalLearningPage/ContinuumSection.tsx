"use client"

import React from "react"
import { styled } from "ol-components"
import {
  Section,
  SectionInner,
  SectionEyebrow,
  SectionHeading,
  SectionBody,
  SectionHeader,
} from "./SectionLayout"
import { continuum as copy } from "./copy"

const Band = styled(Section)(({ theme }) => ({
  backgroundColor: theme.custom.colors.lightGray1,
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

const Timeline = styled.div(({ theme }) => ({
  display: "flex",
  position: "relative",
  alignItems: "center",
  margin: "16px 0 40px",
  "&::before": {
    content: '""',
    position: "absolute",
    left: "16.667%",
    right: "16.667%",
    height: "1px",
    backgroundColor: theme.custom.colors.red,
  },
  [theme.breakpoints.down("md")]: {
    display: "none",
  },
}))

const TimelineDot = styled.span(({ theme }) => ({
  flex: "1 1 0",
  display: "flex",
  justifyContent: "center",
  "&::before": {
    content: '""',
    width: "12px",
    height: "12px",
    borderRadius: "50%",
    backgroundColor: theme.custom.colors.red,
  },
}))

const Steps = styled.ol(({ theme }) => ({
  display: "flex",
  listStyle: "none",
  margin: 0,
  padding: 0,
  [theme.breakpoints.down("md")]: {
    flexDirection: "column",
    gap: "1px",
  },
}))

const Step = styled.li<{ tone: "bare" | "light" | "dark" }>(
  ({ theme, tone }) => ({
    flex: "1 1 0",
    minWidth: 0,
    padding: "32px",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    backgroundColor: {
      bare: "transparent",
      light: theme.custom.colors.white,
      dark: theme.custom.colors.darkGray2,
    }[tone],
    [theme.breakpoints.down("md")]: {
      padding: "24px",
    },
  }),
)

const StepEyebrow = styled.p<{ inverted: boolean }>(({ theme, inverted }) => ({
  ...theme.typography.subtitle3,
  color: inverted
    ? theme.custom.colors.silverGrayLight
    : theme.custom.colors.silverGrayDark,
  margin: 0,
}))

const StepTitle = styled.h3<{ inverted: boolean }>(({ theme, inverted }) => ({
  ...theme.typography.h5,
  color: inverted ? theme.custom.colors.white : theme.custom.colors.darkGray2,
  margin: 0,
}))

const StepBody = styled.p<{ inverted: boolean }>(({ theme, inverted }) => ({
  ...theme.typography.body2,
  color: inverted
    ? theme.custom.colors.lightGray2
    : theme.custom.colors.silverGrayDark,
  margin: 0,
}))

const TONES = ["bare", "light", "dark"] as const

const ContinuumSection: React.FC = () => (
  <Band aria-labelledby="continuum-heading">
    <Inner>
      <CenteredHeader>
        <SectionEyebrow>{copy.eyebrow}</SectionEyebrow>
        <SectionHeading id="continuum-heading">{copy.title}</SectionHeading>
        <SectionBody>{copy.body}</SectionBody>
      </CenteredHeader>

      <div>
        <Timeline aria-hidden>
          {copy.steps.map((step) => (
            <TimelineDot key={step.title} />
          ))}
        </Timeline>
        <Steps>
          {copy.steps.map((step, index) => {
            const tone = TONES[index] ?? "bare"
            const inverted = tone === "dark"
            return (
              <Step key={step.title} tone={tone}>
                <StepEyebrow inverted={inverted}>{step.eyebrow}</StepEyebrow>
                <StepTitle inverted={inverted}>{step.title}</StepTitle>
                <StepBody inverted={inverted}>{step.body}</StepBody>
              </Step>
            )
          })}
        </Steps>
      </div>
    </Inner>
  </Band>
)

export default ContinuumSection
