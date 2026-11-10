"use client"

import React from "react"
import Image from "next/image"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import DOMPurify from "isomorphic-dompurify"
import { Skeleton, styled } from "ol-components"
import { ButtonLink } from "@mitodl/smoot-design"
import { RiArrowRightLine, RiPlayFill } from "@remixicon/react"
import type { LearningResource } from "api"
import {
  podcastEpisodeQueries,
  videoQueries,
} from "api/hooks/learningResources"
import { DEFAULT_RESOURCE_IMG } from "ol-utilities"
import { stripAnchorTags } from "@/common/utils"
import { Section, SectionInner } from "./SectionLayout"
import { SEARCH_INSTRUCTOR_INSIGHTS, SEARCH_VIDEOS_AND_PODCASTS } from "./links"
import {
  TEACHING_PODCAST_EPISODES_PARAMS,
  TEACHING_VIDEOS_PARAMS,
} from "./queryParams"

const Band = styled(Section)(({ theme }) => ({
  backgroundColor: theme.custom.colors.white,
  borderTop: `1px solid ${theme.custom.colors.lightGray2}`,
}))

const Inner = styled(SectionInner)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: "32px",
  paddingTop: "80px",
  [theme.breakpoints.down("md")]: {
    gap: "24px",
    paddingTop: "40px",
  },
}))

const Header = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "8px",
})

const Heading = styled.h2(({ theme }) => ({
  ...theme.typography.h2,
  color: theme.custom.colors.darkGray2,
  margin: 0,
  [theme.breakpoints.down("md")]: {
    ...theme.typography.h3,
  },
}))

const Body = styled.p(({ theme }) => ({
  ...theme.typography.body1Loose,
  color: theme.custom.colors.darkGray2,
  margin: 0,
}))

const Cards = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "flex-start",
  gap: "40px",
  [theme.breakpoints.down("md")]: {
    flexDirection: "column",
    alignItems: "stretch",
    gap: "16px",
  },
}))

/**
 * Each card is clickable as a whole: its main link stretches over the card
 * (`stretchedLink`), so there is no link nested inside another. Any other link
 * in a card is lifted above that overlay with `position: relative`.
 */
const Card = styled.article(({ theme }) => ({
  position: "relative",
  display: "flex",
  overflow: "hidden",
  backgroundColor: theme.custom.colors.white,
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  borderRadius: "8px",
  "&:hover, &:has(:focus-visible)": {
    borderColor: theme.custom.colors.darkGray2,
    h3: { color: theme.custom.colors.red },
  },
}))

const stretchedLink = {
  "&::after": {
    content: '""',
    position: "absolute" as const,
    inset: 0,
  },
}

const FeaturedCard = styled(Card)(({ theme }) => ({
  flex: "680 1 0",
  minWidth: 0,
  flexDirection: "column",
  [theme.breakpoints.down("md")]: {
    flex: "initial",
  },
}))

const SideColumn = styled.div(({ theme }) => ({
  flex: "556 1 0",
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: "16px",
  [theme.breakpoints.down("md")]: {
    flex: "initial",
  },
}))

const FeaturedImage = styled.div({
  position: "relative",
  height: "290px",
})

const PlayIcon = styled.span({
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  display: "flex",
  padding: "24px",
  borderRadius: "100px",
  backgroundColor: "rgba(255, 255, 255, 0.25)",
  color: "white",
  svg: { width: "44px", height: "44px" },
})

const CoverImage = styled(Image)({
  objectFit: "cover",
})

const FeaturedText = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: "16px",
  padding: "24px 32px",
  [theme.breakpoints.down("sm")]: {
    padding: "16px",
  },
}))

const FeaturedTitle = styled.h3(({ theme }) => ({
  ...theme.typography.h4,
  color: theme.custom.colors.darkGray2,
  margin: 0,
}))

const TitleLink = styled(Link)({
  ...stretchedLink,
  color: "inherit",
  textDecoration: "none",
})

const clamp = (lines: number) => ({
  display: "-webkit-box",
  WebkitLineClamp: lines,
  WebkitBoxOrient: "vertical" as const,
  overflow: "hidden",
})

/**
 * Video and podcast descriptions come from the API as HTML, so this is a div
 * (paragraphs can't nest in a <p>) and child margins are reset so the clamp
 * counts only text lines. Anchors are stripped: the card itself is the link.
 */
const DescriptionRoot = styled.div<{ lines: number }>(({ theme, lines }) => ({
  ...theme.typography.body1Loose,
  ...clamp(lines),
  color: theme.custom.colors.darkGray2,
  margin: 0,
  "& > *": { margin: 0 },
}))

const Description: React.FC<{ html: string; lines: number }> = ({
  html,
  lines,
}) => (
  <DescriptionRoot
    lines={lines}
    dangerouslySetInnerHTML={{
      __html: stripAnchorTags(DOMPurify.sanitize(html)),
    }}
  />
)

const ArrowLink = styled(Link, {
  shouldForwardProp: (prop) => prop !== "underline" && prop !== "stretched",
})<{ underline?: boolean; stretched?: boolean }>(
  ({ theme, underline, stretched }) => ({
    ...theme.typography.body1Loose,
    ...(stretched ? stretchedLink : { position: "relative" as const }),
    display: "inline-flex",
    alignItems: "center",
    gap: "10px",
    alignSelf: "flex-start",
    color: theme.custom.colors.darkGray2,
    textDecoration: underline ? "underline" : "none",
    svg: { width: "20px", height: "20px", flexShrink: 0 },
    "&:hover": {
      textDecoration: "underline",
    },
  }),
)

const SideCardRoot = styled(Card)({
  height: "198px",
})

const SideImage = styled.div(({ theme }) => ({
  position: "relative",
  flexShrink: 0,
  width: "196px",
  [theme.breakpoints.down("sm")]: {
    width: "120px",
  },
}))

const SideText = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  gap: "16px",
  flex: 1,
  minWidth: 0,
  padding: "16px 32px",
  [theme.breakpoints.down("sm")]: {
    padding: "12px 16px",
  },
}))

const SideCopy = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "12px",
})

const SideTitle = styled.h3(({ theme }) => ({
  ...theme.typography.h5,
  ...clamp(1),
  color: theme.custom.colors.black,
  margin: 0,
}))

const MoreButton = styled(ButtonLink)({
  width: "100%",
})

const resourceImage = (resource: LearningResource) => ({
  src: resource.image?.url ?? DEFAULT_RESOURCE_IMG,
  alt: resource.image?.alt ?? "",
})

const FeaturedVideoCard: React.FC<{ video: LearningResource }> = ({
  video,
}) => (
  <FeaturedCard>
    <FeaturedImage>
      <CoverImage
        {...resourceImage(video)}
        fill
        sizes="(max-width: 900px) 100vw, 680px"
      />
      <PlayIcon aria-hidden>
        <RiPlayFill />
      </PlayIcon>
    </FeaturedImage>
    <FeaturedText>
      <FeaturedTitle>
        <TitleLink href={video.learn_url}>{video.title}</TitleLink>
      </FeaturedTitle>
      {video.description ? (
        <Description lines={3} html={video.description} />
      ) : null}
      <ArrowLink href={SEARCH_INSTRUCTOR_INSIGHTS} underline>
        Explore more courses with Instructor insights
        <RiArrowRightLine aria-hidden />
      </ArrowLink>
    </FeaturedText>
  </FeaturedCard>
)

const SideCard: React.FC<{ resource: LearningResource; linkLabel: string }> = ({
  resource,
  linkLabel,
}) => (
  <SideCardRoot>
    <SideImage>
      <CoverImage {...resourceImage(resource)} fill sizes="196px" />
    </SideImage>
    <SideText>
      <SideCopy>
        <SideTitle>{resource.title}</SideTitle>
        {resource.description ? (
          <Description lines={2} html={resource.description} />
        ) : null}
      </SideCopy>
      <ArrowLink href={resource.learn_url} stretched>
        {linkLabel}
        <RiArrowRightLine aria-hidden />
      </ArrowLink>
    </SideText>
  </SideCardRoot>
)

const TeachingPracticesSection: React.FC = () => {
  const videos = useQuery(videoQueries.list(TEACHING_VIDEOS_PARAMS))
  const episodes = useQuery(
    podcastEpisodeQueries.list(TEACHING_PODCAST_EPISODES_PARAMS),
  )
  const [featuredVideo, sideVideo] = videos.data?.results ?? []
  const episode = episodes.data?.results[0]

  if (!videos.isLoading && !episodes.isLoading && !featuredVideo && !episode) {
    return null
  }

  return (
    <Band>
      <Inner>
        <Header>
          <Heading>Learn from MIT teaching practices</Heading>
          <Body>See how MIT instructors design and run their courses.</Body>
        </Header>
        <Cards>
          {videos.isLoading ? (
            <FeaturedCard>
              <Skeleton variant="rectangular" height={480} />
            </FeaturedCard>
          ) : featuredVideo ? (
            <FeaturedVideoCard video={featuredVideo} />
          ) : null}
          <SideColumn>
            {videos.isLoading ? (
              <Skeleton variant="rounded" height={198} />
            ) : sideVideo ? (
              <SideCard resource={sideVideo} linkLabel="Watch on MIT Learn" />
            ) : null}
            {episodes.isLoading ? (
              <Skeleton variant="rounded" height={198} />
            ) : episode ? (
              <SideCard resource={episode} linkLabel="Listen on MIT Learn" />
            ) : null}
            <MoreButton
              variant="bordered"
              size="large"
              href={SEARCH_VIDEOS_AND_PODCASTS}
            >
              Explore More Videos and Podcasts
            </MoreButton>
          </SideColumn>
        </Cards>
      </Inner>
    </Band>
  )
}

export default TeachingPracticesSection
