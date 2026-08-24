"use client"

import React, { useMemo, useState } from "react"
import {
  Skeleton,
  TabContext,
  TabPanel,
  Typography,
  TypographyProps,
  styled,
} from "ol-components"
import { TabButton, TabButtonList, VisuallyHidden } from "@mitodl/smoot-design"

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
  p: {
    margin: 0,
  },
  "p + p": {
    marginTop: "24px",
  },
}) as typeof Body

// Focus lands here rather than on a child, so the ring belongs to the panel.
const TranscriptPanel = styled(TabPanel)({
  "&:focus-visible": {
    outlineOffset: "4px",
  },
})

const SkeletonLine = styled(Skeleton)({
  marginBottom: "16px",
})

const TRANSCRIPT_SKELETON_WIDTHS = ["100%", "97%", "92%", "100%", "60%"]

const TranscriptSkeleton = () => (
  <div data-testid="transcript-skeleton" aria-hidden>
    {TRANSCRIPT_SKELETON_WIDTHS.map((width, index) => (
      <SkeletonLine
        // eslint-disable-next-line react/no-array-index-key
        key={index}
        variant="text"
        width={width}
        height={20}
      />
    ))}
  </div>
)

/**
 * The transcript's fetch state, as the tabs need to see it.
 *
 * A discriminated union rather than separate `hasTranscript` / `isLoading` /
 * `isError` props: the combinations those would allow (loading *and* error,
 * text *and* absent) have no meaning here, and the panel renders exactly one
 * of these four cases.
 */
export type TranscriptState =
  /** No transcript to show, so no Transcript tab. */
  | { status: "absent" }
  /** The episode reports a transcript and the request is in flight. */
  | { status: "loading" }
  /** The episode reports a transcript and the request failed. */
  | { status: "error" }
  | { status: "ready"; text: string }

// Announced by the panel's live region as the state changes.
const TRANSCRIPT_STATUS_MESSAGES: Record<TranscriptState["status"], string> = {
  absent: "",
  loading: "Loading transcript",
  error: "The transcript could not be loaded.",
  ready: "Transcript loaded",
}

type EpisodeContentTabsProps = {
  /**
   * Sanitized description HTML. Sanitized with nh3 during ETL, so it is safe to
   * render verbatim -- the same trust model as resource descriptions elsewhere.
   */
  descriptionHtml: string | null
  /**
   * The transcript and its fetch state. `ready` carries normalized plain text
   * with paragraphs separated by a blank line, rendered as escaped text and
   * never as HTML: unlike the description this is third-party text that was
   * never sanitized for markup.
   */
  transcript: TranscriptState
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
 * The tablist appears as soon as the episode reports a transcript, not once the
 * text arrives, so the tab set does not shift under someone already reading the
 * description. Until then the Transcript panel carries a skeleton and
 * `aria-busy`, and a failed fetch says so rather than silently dropping the tab.
 *
 * With no transcript at all there is nothing to switch between, so the
 * description renders on its own with no tablist.
 */
const EpisodeContentTabs: React.FC<EpisodeContentTabsProps> = ({
  descriptionHtml,
  transcript,
}) => {
  const [tab, setTab] = useState(DESCRIPTION_TAB)

  const paragraphs = useMemo(
    () =>
      transcript.status === "ready"
        ? transcript.text.split("\n\n").filter(Boolean)
        : [],
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

  const transcriptContent = (
    <>
      {/*
        A live region that stays mounted across all three states, so changing
        its text is what announces the outcome. Replacing one element with
        another would not: removing a live region announces nothing. It sits
        inside the panel, so nothing is announced while the reader is on the
        Description tab -- a `hidden` panel is out of the accessibility tree.
      */}
      <VisuallyHidden role="status">
        {TRANSCRIPT_STATUS_MESSAGES[transcript.status]}
      </VisuallyHidden>
      {transcript.status === "ready" ? (
        <TranscriptBody variant="body1" component="div">
          {paragraphs.map((paragraph, index) => (
            // eslint-disable-next-line react/no-array-index-key
            <p key={index}>{paragraph}</p>
          ))}
        </TranscriptBody>
      ) : (
        <Body variant="body1" component="div">
          {transcript.status === "loading" ? (
            <TranscriptSkeleton />
          ) : (
            "The transcript could not be loaded. Reload the page to try again."
          )}
        </Body>
      )}
    </>
  )

  // Tabs only earn their place when there are two things to switch between.
  // With no transcript, the description stands alone; with a transcript but no
  // description, showing tabs would open on an empty Description panel, so the
  // transcript stands alone instead.
  if (transcript.status === "absent") {
    return description
  }
  if (!descriptionHtml) {
    return transcriptContent
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
      <TranscriptPanel
        value={TRANSCRIPT_TAB}
        keepMounted
        aria-busy={transcript.status === "loading"}
        // tabIndex on the panel itself, per the WAI-ARIA APG, so focus lands
        // with the panel's role and name announced. Only once there is a long
        // transcript to reach: the skeleton and the error message are short and
        // hold nothing to scroll.
        tabIndex={transcript.status === "ready" ? 0 : undefined}
      >
        {transcriptContent}
      </TranscriptPanel>
    </TabContext>
  )
}

export default EpisodeContentTabs
