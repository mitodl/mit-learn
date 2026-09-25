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

const COLLAPSED_HEIGHT = 120

const buildPrompt = (query: string) =>
  `give me some courses i might find interesting if i search "${query}". start with "here are some courses". don't attempt to continue the conversation. keep it brief. make it interesting to someone who wants to learn more ~ lead on`

const Container = styled.section(({ theme }) => ({
  position: "relative",
  backgroundColor: theme.custom.colors.lightGray1,
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  borderRadius: "8px",
  padding: "24px 28px",
  marginBottom: "16px",
  [theme.breakpoints.down("md")]: {
    padding: "16px",
  },
}))

const Header = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: "10px",
  svg: {
    fill: theme.custom.colors.red,
    width: "24px",
    height: "24px",
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
  ...theme.typography.body1,
  color: theme.custom.colors.darkGray2,
  marginTop: "12px",
  overflow: "hidden",
  maxHeight: collapsed ? `${COLLAPSED_HEIGHT}px` : "none",
  maskImage: collapsed
    ? "linear-gradient(to bottom, black 50%, transparent 100%)"
    : "none",
  "p, ul, ol": {
    margin: "0 0 12px",
  },
  "li p": {
    color: theme.custom.colors.silverGrayDark,
  },
  a: {
    color: theme.custom.colors.red,
  },
}))

const ShowMoreButton = styled(Button)(({ theme }) => ({
  position: "absolute",
  left: "50%",
  bottom: 0,
  transform: "translate(-50%, 50%)",
  backgroundColor: theme.custom.colors.white,
}))

const StyledAiChatDisplay = styled(AiChatDisplay)({
  // Hide the templated prompt that seeded the conversation.
  ".MitAiChat--messageRow:first-of-type[data-chat-role='user']": {
    display: "none",
  },
})

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
        <CloseButton
          onClick={onClose}
          variant="text"
          size="medium"
          aria-label="Close"
        >
          <RiCloseLine />
        </CloseButton>
      </CloseButtonContainer>
      <StyledAiChatDisplay
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
