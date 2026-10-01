import { env } from "@/env"
import React, { useEffect, useMemo, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import { styled, keyframes, Drawer, Typography } from "ol-components"
import { Button } from "@mitodl/smoot-design"
import {
  AiChatDisplay,
  AiChatProvider,
  useAiChat,
} from "@mitodl/smoot-design/ai"
import type { AiChatProps } from "@mitodl/smoot-design/ai"
import {
  RiArrowDownLine,
  RiCloseLine,
  RiSparkling2Line,
} from "@remixicon/react"
import { useFeatureFlagEnabled, usePostHog } from "posthog-js/react"
import { FeatureFlags } from "@/common/feature_flags"
import { PostHogEvents } from "@/common/constants"
import type { RegisteredSearchParams } from "@/common/searchParams"
import {
  CloseButton,
  CloseButtonContainer,
  getRecommendationRequestOpts,
} from "@/page-components/AiChat/AiRecommendationBotDrawer"

const COLLAPSED_HEIGHT = 100
// Shared by the loading spinner and the sparkle icon so the header doesn't
// shift when the summary replaces the loading state.
const HEADER_ICON_SIZE = 20

const getOverviewRequestOpts = (): AiChatProps["requestOpts"] => {
  const requestOpts = getRecommendationRequestOpts()
  return {
    ...requestOpts,
    // learn-ai has a separate search summary agent with its own prompt, thread
    // cookie and rate limit, so this doesn't touch the AskTIM drawer's thread.
    apiUrl: env("NEXT_PUBLIC_LEARN_AI_SEARCH_SUMMARY_ENDPOINT")!,
    // Start a fresh thread per search, then send its thread_id with follow-ups.
    // The thread cookie only remembers the latest search, so relying on it
    // would send follow-ups from an older tab into the wrong thread.
    // learn-ai ends each response with <!-- {"thread_id": ...} -->.
    transformBody: (messages, body) => {
      const threadId = messages
        .findLast((m) => m.role === "assistant")
        ?.content.match(/"thread_id":\s*"([^"]+)"/)?.[1]
      return {
        ...(requestOpts.transformBody?.(messages, body) as object),
        ...(threadId ? { thread_id: threadId } : { clear_history: true }),
      }
    },
  }
}

const Container = styled.section<{ hasShowMore?: boolean }>(
  ({ theme, hasShowMore }) => ({
    position: "relative",
    backgroundColor: theme.custom.colors.lightGray1,
    border: `1px solid ${theme.custom.colors.lightGray2}`,
    borderRadius: "8px",
    padding: "16px 24px",
    marginBottom: "16px",
    // Extra room for the "Show more" button overlapping the bottom edge.
    paddingBottom: hasShowMore ? "24px" : "16px",
    [theme.breakpoints.down("md")]: {
      paddingLeft: "16px",
      paddingRight: "16px",
    },
  }),
)

const Header = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: "8px",
  minHeight: `${HEADER_ICON_SIZE}px`,
  svg: {
    flexShrink: 0,
    fill: theme.custom.colors.red,
    width: `${HEADER_ICON_SIZE}px`,
    height: `${HEADER_ICON_SIZE}px`,
  },
}))

const HeaderLabel = styled(Typography)(({ theme }) => ({
  ...theme.typography.subtitle3,
  fontSize: theme.typography.pxToRem(10),
  lineHeight: theme.typography.pxToRem(12),
  textTransform: "uppercase",
  letterSpacing: "1.5px",
  color: theme.custom.colors.darkGray2,
  fontWeight: theme.typography.fontWeightBold,
  span: {
    color: theme.custom.colors.silverGrayDark,
    fontWeight: theme.typography.fontWeightMedium,
    marginLeft: "4px",
  },
})) as typeof Typography

const spin = keyframes({
  to: { transform: "rotate(360deg)" },
})

// A ring whose arc fades out toward its tail.
const Spinner = styled.span(({ theme }) => ({
  flexShrink: 0,
  width: `${HEADER_ICON_SIZE}px`,
  height: `${HEADER_ICON_SIZE}px`,
  borderRadius: "50%",
  background: `conic-gradient(transparent 10%, ${theme.custom.colors.darkGray2})`,
  mask: "radial-gradient(farthest-side, transparent calc(100% - 2px), black calc(100% - 2px))",
  animation: `${spin} 0.8s linear infinite`,
"@media (prefers-reduced-motion: reduce)": {
  animation: "none",
},
}))

const Content = styled.div<{ collapsed: boolean }>(({ theme, collapsed }) => ({
  ...theme.typography.body2,
  color: theme.custom.colors.darkGray2,
  marginTop: "8px",
  overflow: "hidden",
  maxHeight: collapsed ? `${COLLAPSED_HEIGHT}px` : "none",
  maskImage: collapsed
    ? "linear-gradient(to bottom, black 50%, transparent 100%)"
    : "none",
  "p, ul, ol": {
    margin: "0 0 16px",
  },
  ol: {
    paddingInlineStart: "22px",
  },
  "ol > li": {
    ...theme.typography.body2,
    marginBottom: "12px",
    "&::marker": {
      color: theme.custom.colors.red,
    },
  },
  // Responses put the course title and description in one paragraph,
  // separated by a line break.
  "li p": {
    ...theme.typography.body2,
    color: theme.custom.colors.silverGray,
  },
  "li strong": {
    ...theme.typography.body2,
    display: "block",
    marginBottom: "4px",
    color: theme.custom.colors.darkGray1,
  },
  "li strong + br": {
    display: "none",
  },
  a: {
    color: theme.custom.colors.red,
    textDecoration: "none",
    "&:hover": {
      textDecoration: "underline",
    },
  },
}))

const ShowMoreButton = styled(Button)(({ theme }) => ({
  position: "absolute",
  left: "50%",
  bottom: 0,
  transform: "translate(-50%, 50%)",
  backgroundColor: theme.custom.colors.white,
}))

const DrawerChatDisplay = styled(AiChatDisplay)(({ theme }) => ({
  "& .MitAiChat--chatScreenContainer": {
    padding: "0 40px",
    [theme.breakpoints.down("md")]: {
      padding: "0 16px",
    },
  },
  "& .MitAiChat--title": {
    paddingRight: "72px", // clear the close button
  },
  "& .MitAiChat--messagesContainer": {
    paddingTop: 0,
  },
  // Hide the search query that seeded the conversation.
  "& .MitAiChat--messageRow:first-of-type[data-chat-role='user']": {
    display: "none",
  },
  // Message formatting (lists, links) is left to AiChat's defaults so the
  // drawer matches the AskTIM drawer.
}))

const DrawerCloseButton = styled(CloseButton)(({ theme }) => ({
  right: "40px",
  [theme.breakpoints.down("md")]: {
    right: "16px",
  },
}))

const OverviewDrawer: React.FC<{ open: boolean; onClose: () => void }> = ({
  open,
  onClose,
}) => {
  const [scrollElement, setScrollElement] = useState<HTMLElement | null>(null)
  return (
    <Drawer
      open={open}
      onClose={onClose}
      anchor="right"
      aria-label="AskTIM course recommendations"
      PaperProps={{
        ref: (node: HTMLDivElement | null) => {
          if (node) setScrollElement(node)
        },
        sx: (theme) => ({
          minWidth: "900px",
          [theme.breakpoints.down("md")]: {
            width: "100%",
            minWidth: "auto",
          },
        }),
      }}
    >
      <CloseButtonContainer>
        <DrawerCloseButton
          onClick={onClose}
          variant="text"
          size="medium"
          aria-label="Close"
        >
          <RiCloseLine />
        </DrawerCloseButton>
      </CloseButtonContainer>
      <DrawerChatDisplay
        entryScreenEnabled={false}
        askTimTitle="to recommend a course"
        scrollElement={scrollElement}
      />
    </Drawer>
  )
}

const Overview: React.FC<{ query: string }> = ({ query }) => {
  const { messages, append, status } = useAiChat()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const posthog = usePostHog()
  const requested = useRef(false)

  useEffect(() => {
    if (requested.current) return
    requested.current = true
    // The search summary agent's prompt handles formatting, so just send the
    // query itself.
    append({ role: "user", content: query })
  }, [append, query])

  // The overview only shows the first response; follow-ups happen in the drawer.
  const responseMessage = messages.find((m) => m.role === "assistant")
  const response = responseMessage?.content

  if (status === "error" || responseMessage?.data?.error?.message?.trim()) {
    return null
  }

  if (!response) {
    return (
      <Container aria-busy="true">
        <Header>
          <Spinner role="progressbar" aria-label="Loading" />
          <HeaderLabel component="h2">
            AI Overview:<span>Reviewing your request…</span>
          </HeaderLabel>
        </Header>
      </Container>
    )
  }

  return (
    <Container hasShowMore>
      <Header>
        <RiSparkling2Line aria-hidden />
        <HeaderLabel component="h2">AI Overview</HeaderLabel>
      </Header>
      <Content collapsed>
        <ReactMarkdown skipHtml>{response}</ReactMarkdown>
      </Content>
      <ShowMoreButton
        variant="bordered"
        size="small"
        endIcon={<RiArrowDownLine />}
        onClick={() => {
          setDrawerOpen(true)
          if (env("NEXT_PUBLIC_POSTHOG_API_KEY")) {
            posthog.capture(PostHogEvents.AskTimClicked, {
              type: "search_ai_overview",
            })
          }
        }}
      >
        Show more
      </ShowMoreButton>
      <OverviewDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </Container>
  )
}

interface AiSearchOverviewProps {
  searchParams: RegisteredSearchParams
}

const AiSearchOverview: React.FC<AiSearchOverviewProps> = ({
  searchParams,
}) => {
  const query = searchParams.get("q")?.trim() || undefined
  const enabled = useFeatureFlagEnabled(FeatureFlags.SearchAiOverview)
  const requestOpts = useMemo(() => getOverviewRequestOpts(), [])

  if (!enabled || !query) return null

  return (
    // Keyed on query so a new search starts a fresh conversation.
    <AiChatProvider key={query} requestOpts={requestOpts}>
      <Overview query={query} />
    </AiChatProvider>
  )
}

export default AiSearchOverview
