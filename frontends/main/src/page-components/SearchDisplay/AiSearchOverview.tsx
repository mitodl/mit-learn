import { env } from "@/env"
import React, { useEffect, useMemo, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import { styled, Drawer, LoadingSpinner, Typography } from "ol-components"
import { Button } from "@mitodl/smoot-design"
import {
  AiChatDisplay,
  AiChatProvider,
  useAiChat,
} from "@mitodl/smoot-design/ai"
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

const buildPrompt = (query: string) =>
  `give me some courses i might find interesting if i search "${query}". start with "here are some courses". don't attempt to continue the conversation. keep it brief. make it interesting to someone who wants to learn more ~ lead on`

const Container = styled.section(({ theme }) => ({
  position: "relative",
  backgroundColor: theme.custom.colors.lightGray1,
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  borderRadius: "8px",
  padding: "16px 24px 24px",
  marginBottom: "16px",
  [theme.breakpoints.down("md")]: {
    padding: "16px",
  },
}))

const Header = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: "8px",
  minHeight: "24px",
  svg: {
    fill: theme.custom.colors.red,
    width: "20px",
    height: "20px",
  },
}))

const HeaderLabel = styled(Typography)(({ theme }) => ({
  ...theme.typography.subtitle3,
  textTransform: "uppercase",
  letterSpacing: "1.5px",
  color: theme.custom.colors.darkGray2,
  fontWeight: theme.typography.fontWeightBold,
  span: {
    color: theme.custom.colors.silverGrayDark,
    fontWeight: theme.typography.fontWeightMedium,
    marginLeft: "8px",
  },
})) as typeof Typography

const Spinner = styled(LoadingSpinner)(({ theme }) => ({
  color: theme.custom.colors.darkGray1,
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
    ...theme.typography.body1,
    color: theme.custom.colors.darkGray1,
    marginBottom: "12px",
  },
  // Responses put the course title and description in one paragraph,
  // separated by a line break.
  "li p": {
    ...theme.typography.body2,
    color: theme.custom.colors.silverGray,
  },
  "li strong": {
    ...theme.typography.body1,
    display: "block",
    marginBottom: "10px",
    color: theme.custom.colors.darkGray1,
  },
  "li strong + br": {
    display: "none",
  },
  a: {
    color: "inherit",
    textDecoration: "none",
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
    p: {
      ...theme.typography.h5,
      fontWeight: theme.typography.fontWeightRegular,
    },
  },
  "& .MitAiChat--messagesContainer": {
    paddingTop: 0,
  },
  // Hide the templated prompt that seeded the conversation.
  "& .MitAiChat--messageRow:first-of-type[data-chat-role='user']": {
    display: "none",
  },
  "& .MitAiChat--messageRowAssistant .MitAiChat--message": {
    ...theme.typography.body2Loose,
    color: theme.custom.colors.darkGray2,
    p: {
      margin: "0 0 16px",
    },
    // Each recommended course renders as a heading with a numbered badge,
    // followed by its description.
    ol: {
      counterReset: "ai-recommendation",
      listStyle: "none",
      paddingInlineStart: 0,
      margin: "16px 0",
    },
    "ol > li": {
      counterIncrement: "ai-recommendation",
      margin: "0 0 18px",
    },
    "ol > li strong": {
      ...theme.typography.subtitle1,
      display: "block",
      marginBottom: "8px",
      color: theme.custom.colors.darkGray2,
      "&::after": {
        content: "counter(ai-recommendation)",
        ...theme.typography.body4,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: "16px",
        height: "16px",
        padding: "0 3px",
        marginLeft: "8px",
        verticalAlign: "text-bottom",
        boxSizing: "border-box",
        border: `1px solid ${theme.custom.colors.silverGrayLight}`,
        borderRadius: "3px",
        color: theme.custom.colors.darkGray1,
      },
    },
    "ol > li strong + br": {
      display: "none",
    },
    "ol > li strong a": {
      color: "inherit",
      fontWeight: "inherit",
      textDecoration: "none",
      "&:hover": {
        color: theme.custom.colors.red,
        textDecoration: "underline",
      },
    },
    "ul > li": {
      paddingLeft: "20px",
      margin: "8px 0",
      "&::before": {
        content: '"•"',
        left: "6px",
        color: theme.custom.colors.darkGray2,
      },
    },
  },
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
    append({ role: "user", content: buildPrompt(query) })
  }, [append, query])

  // The overview only shows the first response; follow-ups happen in the drawer.
  const response = messages.find((m) => m.role === "assistant")?.content

  if (status === "error") return null

  if (!response) {
    return (
      <Container aria-busy="true">
        <Header>
          <Spinner loading size={24} color="inherit" />
          <HeaderLabel component="h2">
            AI Overview:<span>Reviewing your request…</span>
          </HeaderLabel>
        </Header>
      </Container>
    )
  }

  return (
    <Container>
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
  const query = searchParams.get("q")?.trim()
  const enabled = useFeatureFlagEnabled(FeatureFlags.SearchAiOverview)
  const requestOpts = useMemo(() => getRecommendationRequestOpts(), [])

  if (!enabled || !query) return null

  return (
    // Keyed on query so a new search starts a fresh conversation.
    <AiChatProvider key={query} requestOpts={requestOpts}>
      <Overview query={query} />
    </AiChatProvider>
  )
}

export default AiSearchOverview
