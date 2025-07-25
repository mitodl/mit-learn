"use client"

import React, { useState, useCallback } from "react"
import { useRouter } from "next-nprogress-bar"
import { FeatureFlags } from "@/common/feature_flags"
import { useFeatureFlagEnabled, usePostHog } from "posthog-js/react"
import AskTimDrawerButton from "@/page-components/AiChat/AskTimDrawerButton"

import {
  Typography,
  styled,
  ChipLink,
  Link,
  SearchInputProps,
} from "ol-components"
import type { ChipLinkProps } from "ol-components"
import {
  SEARCH_CERTIFICATE,
  SEARCH_FREE,
  SEARCH_NEW,
  SEARCH_POPULAR,
  SEARCH_UPCOMING,
} from "@/common/urls"
import {
  RiAwardLine,
  RiFileAddLine,
  RiPriceTag3Line,
  RiSearch2Line,
  RiThumbUpLine,
  RiTimeLine,
} from "@remixicon/react"
import Image from "next/image"
import { SearchField } from "@/page-components/SearchField/SearchField"
import { PostHogEvents } from "@/common/constants"

type SearchChip = {
  label: string
  href: string
  variant?: ChipLinkProps["variant"]
  icon?: React.ReactElement
}

const SEARCH_CHIPS: SearchChip[] = [
  {
    label: "Recently Added",
    href: SEARCH_NEW,
    variant: "outlinedWhite",
    icon: <RiFileAddLine />,
  },
  {
    label: "Popular",
    href: SEARCH_POPULAR,
    variant: "outlinedWhite",
    icon: <RiThumbUpLine />,
  },
  {
    label: "Upcoming",
    href: SEARCH_UPCOMING,
    variant: "outlinedWhite",
    icon: <RiTimeLine />,
  },
  {
    label: "Free",
    href: SEARCH_FREE,
    variant: "outlinedWhite",
    icon: <RiPriceTag3Line />,
  },
  {
    label: "With Certificate",
    href: SEARCH_CERTIFICATE,
    variant: "outlinedWhite",
    icon: <RiAwardLine />,
  },
  {
    label: "Explore All",
    href: "/search/",
    variant: "outlined",
    icon: <RiSearch2Line />,
  },
]

const HeroWrapper = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  gap: "51px",
  color: theme.custom.colors.darkGray2,
}))

const TitleAndControls = styled.div({
  flex: "1 1 auto",
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  justifyContent: "center",
  marginTop: "32px",
  marginBottom: "32px",
})

const ImageContainer = styled.div(({ theme }) => ({
  flex: "0 1.33 auto",
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  marginTop: "44px",
  width: "513px",
  aspectRatio: "513 / 522",
  [theme.breakpoints.down("md")]: {
    display: "none",
  },
  img: {
    width: "100%",
    transform: "translateX(48px)",
  },
  position: "relative",
}))

const ControlsContainer = styled.div(({ theme }) => ({
  marginTop: "24px",
  display: "flex",
  width: "100%",
  flexDirection: "column",
  alignItems: "flex-start",
  justifyContent: "center",
  [theme.breakpoints.down("sm")]: {
    marginTop: "12px",
    padding: "0",
    gap: "16px",
  },
  [theme.breakpoints.up("sm")]: {
    input: {
      paddingLeft: "5px",
    },
  },
}))

const ActionStrip = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  gap: "24px",
  marginTop: "16px",
  marginBottom: "24px",
  /**
   * minHeight 28px avoids layout shift as feature flag for AskTim button loads.
   */
  minHeight: "28px",
  [theme.breakpoints.down("sm")]: {
    marginTop: "0",
  },
}))

const ActionStripText = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.silverGrayDark,
  ...theme.typography.body2,
  [theme.breakpoints.down("sm")]: {
    ...theme.typography.body3,
  },
}))

const TopicLink = styled(Link)({
  textDecoration: "underline",
})

const TrendingChip = styled(ChipLink)(({ theme, variant }) => [
  {
    height: "32px",
    padding: "8px 16px",
    ".MuiChip-icon": {
      marginRight: "4px",
    },
  },
  variant === "outlinedWhite" && {
    borderColor: theme.custom.colors.lightGray2,
    color: theme.custom.colors.silverGrayDark,
    "&:hover": {
      backgroundColor: `${theme.custom.colors.lightGray1} !important`,
      borderColor: `${theme.custom.colors.silverGrayLight} !important`,
      color: theme.custom.colors.darkGray2,
    },
  },
  variant === "outlined" && {
    backgroundColor: theme.custom.colors.lightGray2,
    color: theme.custom.colors.darkGray2,
    borderColor: theme.custom.colors.lightGray2,
    "&:hover": {
      backgroundColor: `${theme.custom.colors.lightGray2} !important`,
      borderColor: theme.custom.colors.silverGray,
    },
  },
])

const TrendingContainer = styled.div({
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  flexWrap: "wrap",
  gap: "8px",
})

const HeroSearch: React.FC<{ imageIndex: number }> = ({ imageIndex }) => {
  const posthog = usePostHog()
  const posthogCapture = (event: string) => {
    if (process.env.NEXT_PUBLIC_POSTHOG_API_KEY) {
      posthog.capture(event)
    }
  }
  const [searchText, setSearchText] = useState("")
  const onSearchClear = useCallback(() => setSearchText(""), [])
  const router = useRouter()

  const recommendationBotEnabled = useFeatureFlagEnabled(
    FeatureFlags.HomePageRecommendationBot,
  )

  const onSearchChange: SearchInputProps["onChange"] = useCallback((e) => {
    setSearchText(e.target.value)
  }, [])

  const onSearchSubmit: SearchInputProps["onSubmit"] = useCallback(
    (e) => {
      router.push(`/search?q=${e.target.value}`)
    },
    [router],
  )

  return (
    <HeroWrapper>
      <TitleAndControls>
        <Typography
          component="h1"
          typography={{ xs: "h3", md: "h1" }}
          sx={{ paddingBottom: 1 }}
        >
          Learn with MIT
        </Typography>
        <Typography>Lifelong Learning. The MIT way.</Typography>
        <ControlsContainer>
          <SearchField
            size="hero"
            fullWidth
            value={searchText}
            onChange={onSearchChange}
            onClear={onSearchClear}
            onSubmit={onSearchSubmit}
          />
          <div>
            <ActionStrip>
              <ActionStripText>
                {recommendationBotEnabled ? "Browse by " : "or browse by "}
                <TopicLink
                  href="/topics/"
                  onClick={() => {
                    if (process.env.NEXT_PUBLIC_POSTHOG_API_KEY) {
                      posthogCapture(PostHogEvents.HeroBrowseTopics)
                    }
                  }}
                  color="red"
                >
                  Topic
                </TopicLink>
              </ActionStripText>
              {recommendationBotEnabled ? (
                <>
                  <ActionStripText>or</ActionStripText>
                  <AskTimDrawerButton />
                </>
              ) : null}
            </ActionStrip>
            <TrendingContainer>
              {SEARCH_CHIPS.map((chip) => (
                <TrendingChip
                  key={chip.label}
                  variant={chip.variant}
                  size="medium"
                  label={chip.label}
                  href={chip.href}
                  {...(chip.icon && { icon: chip.icon })}
                />
              ))}
            </TrendingContainer>
          </div>
        </ControlsContainer>
      </TitleAndControls>
      <ImageContainer>
        <Image
          alt=""
          src={`/images/hero/hero-${imageIndex}.png`}
          fill
          priority
        />
      </ImageContainer>
    </HeroWrapper>
  )
}

export default HeroSearch
