"use client"

import React, { useMemo, useState } from "react"
import {
  TabContext,
  TabPanel,
  Typography,
  TypographyProps,
  styled,
} from "ol-components"
import { TabButton, TabButtonList } from "@mitodl/smoot-design"

const DESCRIPTION_TAB = "description"
const TRANSCRIPT_TAB = "transcript"

const TabsList = styled(TabButtonList)({
  // TabButtonList defaults to variant="scrollable", which renders scroll
  // buttons that are permanently disabled for two tabs.
  ".MuiTabScrollButton-root.Mui-disabled": {
    display: "none",
  },
  marginTop: "32px",
})

// The Pick<TypographyProps, "component"> generic is what allows component="div"
// below; both panels need it, since the sanitized description contains block
// elements that are invalid inside Typography's default <span>.
const Body = styled(Typography)<Pick<TypographyProps, "component">>(
  ({ theme }) => ({
    color: theme.custom.colors.darkGray2,
    display: "block",
    marginBottom: "32px",
    marginTop: "32px",
    fontSize: "18px",
    fontStyle: "normal",
    lineHeight: "32px",
    a: {
      textDecoration: "underline",
      color: theme.custom.colors.darkGray2,
      fontWeight: theme.typography.fontWeightMedium,
    },
    "a:hover": {
      textDecoration: "none",
    },
    [theme.breakpoints.down("sm")]: {
      ...theme.typography.body1,
      lineHeight: "24px",
      marginTop: "16px",
    },
  }),
)

const TranscriptBody = styled(Body)({
  // The panel holds no focusable content, so it takes a tab stop of its own
  // (WAI-ARIA APG) to let keyboard users reach a long transcript.
  "&:focus-visible": {
    outlineOffset: "4px",
  },
  p: {
    margin: 0,
  },
  "p + p": {
    marginTop: "24px",
  },
}) as typeof Body

type EpisodeContentTabsProps = {
  /**
   * Sanitized description HTML. Sanitized with nh3 during ETL, so it is safe to
   * render verbatim -- the same trust model as resource descriptions elsewhere.
   */
  descriptionHtml: string | null
  /**
   * Normalized plain-text transcript, paragraphs separated by a blank line.
   * Rendered as escaped text, never as HTML: unlike the description this is
   * third-party text that was never sanitized for markup.
   */
  transcript: string | null
}

/**
 * Description and Transcript as tabs, defaulting to Description.
 *
 * Both panels stay mounted at all times and only the `hidden` attribute
 * toggles. That is what keeps the transcript crawlable: search engines index
 * DOM content hidden with CSS or `hidden`, but never content that appears only
 * after a click. `keepMounted` is load-bearing -- @mui/lab's TabPanel unmounts
 * the inactive panel without it.
 *
 * With no transcript there is nothing to switch between, so the description
 * renders on its own with no tablist.
 */
const EpisodeContentTabs: React.FC<EpisodeContentTabsProps> = ({
  descriptionHtml,
  transcript,
}) => {
  const [tab, setTab] = useState(DESCRIPTION_TAB)

  const paragraphs = useMemo(
    () => (transcript ? transcript.split("\n\n").filter(Boolean) : []),
    [transcript],
  )

  const description = descriptionHtml ? (
    // Rendered as a <div>, not the default <p>: the sanitized description
    // contains block elements which are invalid inside a <p>, and the browser
    // would reparent them and break hydration.
    <Body
      variant="body1"
      component="div"
      dangerouslySetInnerHTML={{ __html: descriptionHtml }}
    />
  ) : null

  // tabIndex so keyboard users can reach a long panel with no focusable
  // children (WAI-ARIA APG).
  const transcriptBody = (
    <TranscriptBody variant="body1" component="div" tabIndex={0}>
      {paragraphs.map((paragraph, index) => (
        // eslint-disable-next-line react/no-array-index-key
        <p key={index}>{paragraph}</p>
      ))}
    </TranscriptBody>
  )

  // Tabs only earn their place when there are two things to switch between.
  // With no transcript, the description stands alone; with a transcript but no
  // description, showing tabs would open on an empty Description panel, so the
  // transcript stands alone instead.
  if (!paragraphs.length) {
    return description
  }
  if (!descriptionHtml) {
    return transcriptBody
  }

  return (
    <TabContext value={tab}>
      <TabsList
        aria-label="Episode content"
        onChange={(_event, value) => setTab(value)}
      >
        <TabButton label="Description" value={DESCRIPTION_TAB} />
        <TabButton label="Transcript" value={TRANSCRIPT_TAB} />
      </TabsList>
      <TabPanel value={DESCRIPTION_TAB} keepMounted>
        {description}
      </TabPanel>
      <TabPanel value={TRANSCRIPT_TAB} keepMounted>
        {transcriptBody}
      </TabPanel>
    </TabContext>
  )
}

export default EpisodeContentTabs
