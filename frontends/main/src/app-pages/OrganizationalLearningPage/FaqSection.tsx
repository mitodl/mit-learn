"use client"

import React from "react"
import {
  styled,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from "ol-components"
import { RiAddLine, RiSubtractLine } from "@remixicon/react"
import {
  Section,
  SectionInner,
  SectionEyebrow,
  SectionHeading,
  SectionHeader,
} from "./SectionLayout"
import { faq as copy } from "./copy"

const Band = styled(Section)(({ theme }) => ({
  backgroundColor: theme.custom.colors.white,
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

const Items = styled.div(({ theme }) => ({
  borderTop: `1px solid ${theme.custom.colors.lightGray2}`,
}))

const FaqItem = styled(Accordion)(({ theme }) => ({
  backgroundColor: theme.custom.colors.white,
  borderTop: "none",
  borderBottom: `1px solid ${theme.custom.colors.lightGray2}`,
  borderRadius: 0,
  boxShadow: "none",
  "&::before": { display: "none" },
  "&:first-of-type, &:last-of-type": {
    borderRadius: 0,
  },
}))

const FaqSummary = styled(AccordionSummary)(({ theme }) => ({
  padding: "0 24px",
  ".MuiAccordionSummary-content": {
    margin: "24px 0",
    span: {
      transition: `color ${theme.transitions.duration.shorter}ms`,
    },
  },
  "&:hover .MuiAccordionSummary-content span": {
    color: theme.custom.colors.red,
  },
  [theme.breakpoints.down("md")]: {
    padding: "0 16px",
    ".MuiAccordionSummary-content": { margin: "16px 0" },
  },
}))

const Question = styled.span<{ expanded: boolean }>(({ theme, expanded }) => ({
  ...theme.typography.h5,
  color: expanded ? theme.custom.colors.red : theme.custom.colors.darkGray2,
}))

const Answer = styled(AccordionDetails)(({ theme }) => ({
  ...theme.typography.body1,
  color: theme.custom.colors.silverGrayDark,
  padding: "0 24px 24px",
  [theme.breakpoints.down("md")]: {
    padding: "0 16px 16px",
  },
}))

const FaqRow: React.FC<{ question: string; answer: string }> = ({
  question,
  answer,
}) => {
  const [expanded, setExpanded] = React.useState(false)

  return (
    <FaqItem expanded={expanded} onChange={() => setExpanded(!expanded)}>
      <FaqSummary expandIcon={expanded ? <RiSubtractLine /> : <RiAddLine />}>
        <Question expanded={expanded}>{question}</Question>
      </FaqSummary>
      <Answer>{answer}</Answer>
    </FaqItem>
  )
}

const FaqSection: React.FC = () => (
  <Band aria-labelledby="faq-heading">
    <Inner>
      <CenteredHeader>
        <SectionEyebrow>{copy.eyebrow}</SectionEyebrow>
        <SectionHeading id="faq-heading">{copy.title}</SectionHeading>
      </CenteredHeader>
      <Items>
        {copy.items.map((item) => (
          <FaqRow
            key={item.question}
            question={item.question}
            answer={item.answer}
          />
        ))}
      </Items>
    </Inner>
  </Band>
)

export default FaqSection
