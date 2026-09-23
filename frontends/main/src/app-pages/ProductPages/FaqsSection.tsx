"use client"

import React from "react"
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
} from "ol-components"
import { styled } from "@mitodl/smoot-design"
import { RiAddLine, RiSubtractLine } from "@remixicon/react"
import type { FAQItem } from "@mitodl/mitxonline-api-axios/v2"
import { HeadingIds } from "./util"
import RawHTML from "./RawHTML"
import { buildFaqStructuredData } from "./faqStructuredData"

const FaqsSectionRoot = styled.section({
  display: "flex",
  flexDirection: "column",
  gap: "24px",
})

const Items = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "8px",
})

const FaqItem = styled(Accordion)(({ theme }) => ({
  backgroundColor: theme.custom.colors.lightGray1,
  borderRadius: "4px",
  boxShadow: "none",
  margin: 0,
  "&::before": { display: "none" },
  "&:first-of-type, &:last-of-type": {
    borderRadius: "4px",
  },
  ".MuiAccordion-heading": {
    margin: 0,
  },
}))

const FaqSummary = styled(AccordionSummary)(({ theme }) => ({
  padding: "0 24px",
  ".MuiAccordionSummary-content": {
    margin: "24px 0",
  },
  // Tighten the gap below the question once the answer is showing.
  "&.Mui-expanded .MuiAccordionSummary-content": {
    marginBottom: "16px",
  },
  ".MuiAccordionSummary-expandIconWrapper": {
    color: theme.custom.colors.darkGray2,
  },
  "&.Mui-focusVisible": {
    outline: `2px solid ${theme.custom.colors.red}`,
    outlineOffset: "-2px",
    backgroundColor: "transparent",
  },
  [theme.breakpoints.down("md")]: {
    padding: "0 16px",
    ".MuiAccordionSummary-content": {
      margin: "16px 0",
    },
  },
}))

const Question = styled.span<{ expanded: boolean }>(({ theme, expanded }) => ({
  ...theme.typography.subtitle1,
  color: expanded ? theme.custom.colors.red : theme.custom.colors.darkGray2,
  transition: `color ${theme.transitions.duration.shorter}ms`,
  ".MuiAccordionSummary-root:hover &": {
    color: theme.custom.colors.red,
  },
  [theme.breakpoints.down("md")]: {
    ...theme.typography.subtitle2,
  },
}))

const Answer = styled(AccordionDetails)(({ theme }) => ({
  color: theme.custom.colors.darkGray2,
  padding: "0 24px 24px",
  "ul, ol": {
    paddingLeft: "12px",
  },
  [theme.breakpoints.down("md")]: {
    padding: "0 16px 16px",
  },
}))

const FaqRow: React.FC<{ index: number; faq: FAQItem }> = ({ index, faq }) => {
  const [expanded, setExpanded] = React.useState(false)
  const headerId = `${HeadingIds.Faqs}-header-${index}`
  const panelId = `${HeadingIds.Faqs}-panel-${index}`

  return (
    <FaqItem
      expanded={expanded}
      onChange={() => setExpanded(!expanded)}
      disableGutters
    >
      <FaqSummary
        id={headerId}
        aria-controls={panelId}
        expandIcon={expanded ? <RiSubtractLine /> : <RiAddLine />}
      >
        <Question expanded={expanded}>{faq.question}</Question>
      </FaqSummary>
      <Answer id={panelId} aria-labelledby={headerId}>
        <RawHTML html={faq.answer} />
      </Answer>
    </FaqItem>
  )
}

const FaqsSection: React.FC<{ faqs: FAQItem[] }> = ({ faqs }) => {
  const structuredData = buildFaqStructuredData(faqs)

  return (
    <FaqsSectionRoot aria-labelledby={HeadingIds.Faqs}>
      <Typography variant="h4" component="h2" id={HeadingIds.Faqs}>
        FAQs
      </Typography>
      <Items>
        {faqs.map((faq, index) => (
          <FaqRow key={faq.id} index={index} faq={faq} />
        ))}
      </Items>
      {structuredData ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData)
              .replace(/&/g, "\\u0026")
              .replace(/</g, "\\u003c")
              .replace(/>/g, "\\u003e"),
          }}
        />
      ) : null}
    </FaqsSectionRoot>
  )
}

export default FaqsSection
