"use client"

import React, { useMemo } from "react"
import {
  Container,
  Typography,
  styled,
  Grid2 as Grid,
  PlainList,
  ChipLink,
  linkStyles,
  Banner,
  Skeleton,
  Breadcrumbs,
} from "ol-components"
import Link from "next/link"
import { propsNotNil, backgroundSrcSetCSS } from "ol-utilities"
import { useLearningResourceTopics } from "api/hooks/learningResources"
import { LearningResourceTopic } from "api"
import RootTopicIcon from "@/components/RootTopicIcon/RootTopicIcon"
import { HOME } from "@/common/urls"
import {
  aggregateProgramCounts,
  aggregateCourseCounts,
} from "@/common/client-utils"
import { useChannelCounts } from "api/hooks/channels"
import backgroundSteps from "@/public/images/backgrounds/background_steps.jpg"
import { usePostHog } from "posthog-js/react"
import type { PostHog } from "posthog-js"
import { PostHogEvents } from "@/common/constants"

const captureTopicClicked = (
  posthog: PostHog,
  event: string,
  topic: string,
) => {
  if (process.env.NEXT_PUBLIC_POSTHOG_API_KEY) {
    posthog.capture(event, { topic })
  }
}

type ChannelSummary = {
  id: number | string
  name: string
  channel_url: string
  courses: number
  programs: number
}

type TopicBoxHeaderProps = {
  title: string
  icon?: string
  href?: string
  className?: string
  posthog?: PostHog
}
const TopicBoxHeader = styled(
  ({ title, icon, href, className, posthog }: TopicBoxHeaderProps) => {
    return (
      <Typography variant="h5" component="h2" className={className}>
        <Link
          href={href ?? ""}
          onClick={() => {
            if (posthog) {
              captureTopicClicked(posthog, PostHogEvents.TopicClicked, title)
            }
          }}
        >
          <RootTopicIcon icon={icon} aria-hidden="true" />
          <span>
            <span className="topic-title">{title}</span>
            <span className="view-topic" aria-hidden="true">
              View
            </span>
          </span>
        </Link>
      </Typography>
    )
  },
)(({ theme }) => ({
  a: {
    display: "flex",
    alignItems: "center",
    textDecoration: "none",
  },
  svg: {
    marginRight: "16px",
    [theme.breakpoints.down("sm")]: {
      display: "none",
    },
  },
  "svg, .topic-title": {
    color: theme.custom.colors.black,
  },
  ":hover": {
    "svg, .topic-title": {
      color: theme.custom.colors.red,
    },
  },
  ".view-topic": [
    linkStyles({ size: "medium", color: "black" }),
    {
      color: theme.custom.colors.darkGray1,
      ...theme.typography.body2,
      marginLeft: "16px",
      [theme.breakpoints.down("sm")]: {
        ...theme.typography.body3,
      },
    },
  ],
}))

const TopicBoxBody = styled.div(({ theme }) => ({
  marginTop: "8px",
  marginLeft: "40px",
  [theme.breakpoints.down("sm")]: {
    marginLeft: "0px",
  },
}))

const TopicCounts = styled.div(({ theme }) => ({
  color: theme.custom.colors.silverGrayDark,
  display: "flex",
  gap: "8px",
}))

const ChildTopicsContainer = styled.div<{ mobile: boolean }>(
  ({ theme, mobile }) => ({
    marginTop: "16px",
    flexWrap: "wrap",
    gap: "12px",
    display: mobile ? "none" : "flex",
    [theme.breakpoints.down("sm")]: {
      display: mobile ? "flex" : "none",
      gap: "8px",
    },
  }),
)

type TopicBoxProps = {
  topicGroup: TopicGroup
  className?: string
  courseCount?: number
  programCount?: number
}
const TopicBox = ({
  topicGroup,
  className,
  courseCount,
  programCount,
}: TopicBoxProps) => {
  const posthog = usePostHog()
  const counts = [
    { label: "Courses", count: courseCount },
    { label: "Programs", count: programCount },
  ].filter((item) => item.count)
  const { title, href, icon, channels } = topicGroup

  return (
    <li className={className}>
      <TopicBoxHeader title={title} href={href} icon={icon} posthog={posthog} />
      <TopicBoxBody>
        <TopicCounts>
          {counts.map((item) => (
            <Typography key={item.label} variant="body3">
              {item.label}: {item.count}
            </Typography>
          ))}
        </TopicCounts>
        <ChildTopicsContainer mobile={false}>
          {channels.map((c) => (
            <ChipLink
              size="large"
              variant="outlinedWhite"
              key={c.id}
              href={c.channel_url && new URL(c.channel_url).pathname}
              onClick={() => {
                captureTopicClicked(
                  posthog,
                  PostHogEvents.SubTopicClicked,
                  c.name,
                )
              }}
              label={c.name}
            />
          ))}
        </ChildTopicsContainer>
        <ChildTopicsContainer mobile={true}>
          {channels.map((c) => (
            <ChipLink
              size="medium"
              variant="outlinedWhite"
              key={c.id}
              href={c.channel_url && new URL(c.channel_url).pathname}
              onClick={() => {
                captureTopicClicked(
                  posthog,
                  PostHogEvents.SubTopicClicked,
                  c.name,
                )
              }}
              label={c.name}
            />
          ))}
        </ChildTopicsContainer>
      </TopicBoxBody>
    </li>
  )
}

const TopicBoxLoading = () => {
  return (
    <li>
      <TopicBoxBody>
        <Skeleton variant="text" height={24} width={200} />
        <Skeleton height={150} />
      </TopicBoxBody>
    </li>
  )
}

const Page = styled.div({})

type TopicGroup = {
  id: number
  title: string
  icon?: string
  href?: string
  courses: number
  programs: number
  channels: ChannelSummary[]
}
const groupTopics = (
  topics: LearningResourceTopic[],
  courseCounts: Record<string, number>,
  programCounts: Record<string, number>,
): TopicGroup[] => {
  const sorted = topics.filter(propsNotNil(["channel_url"])).sort((a, b) => {
    return a.name.localeCompare(b.name)
  })
  const groups: Record<number, TopicGroup> = Object.fromEntries(
    sorted
      .filter((topic) => !topic.parent)
      .map((topic) => [
        topic.id,
        {
          id: topic.id,
          channels: [],
          courses: courseCounts[topic.name],
          programs: programCounts[topic.name],
          title: topic.name,
          href: topic.channel_url,
          icon: topic.icon,
        },
      ]),
  )
  sorted.forEach((topic) => {
    if (!topic.parent) return
    if (groups[topic.parent] && topic.channel_url) {
      groups[topic.parent].channels.push({
        id: topic.id,
        name: topic.name,
        channel_url: topic.channel_url,
        courses: courseCounts[topic.name],
        programs: programCounts[topic.name],
      })
    }
  })
  return Object.values(groups)
    .filter((group) => group.channels.length > 0)
    .sort((a, b) => a.title.localeCompare(b.title))
}

const RootTopicList = styled(PlainList)(({ theme }) => ({
  "> li:not(:last-of-type)": {
    paddingBottom: "32px",
  },
  "> li + li": {
    borderTop: `1px solid ${theme.custom.colors.lightGray2}`,
    paddingTop: "32px",
  },
}))

const TopicsListingPage: React.FC = () => {
  const channelCountQuery = useChannelCounts("topic")
  const topicsQuery = useLearningResourceTopics()

  const channelsGroups = useMemo(() => {
    const courseCounts = channelCountQuery.data
      ? aggregateCourseCounts("title", channelCountQuery.data)
      : {}
    const programCounts = channelCountQuery.data
      ? aggregateProgramCounts("title", channelCountQuery.data)
      : {}
    return groupTopics(
      topicsQuery.data?.results ?? [],
      courseCounts,
      programCounts,
    )
  }, [topicsQuery.data?.results, channelCountQuery.data])

  return (
    <Page>
      <Banner
        navText={
          <Breadcrumbs
            variant="dark"
            ancestors={[{ href: HOME, label: "Home" }]}
            current="Topics"
          />
        }
        title="Browse by Topic"
        header="Select a topic below to explore relevant learning resources across all Academic and Professional units."
        backgroundUrl={backgroundSrcSetCSS(backgroundSteps)}
      />
      <Container>
        <Grid container>
          <Grid
            size={{ xs: 12, sm: 10 }}
            offset={{ xs: 0, sm: 1 }}
            sx={(theme) => ({
              margin: "80px 0",
              [theme.breakpoints.down("sm")]: {
                margin: "32px 0",
              },
            })}
          >
            <RootTopicList>
              {topicsQuery.isLoading
                ? Array(10)
                    .fill(null)
                    .map((_null, i) => (
                      <TopicBoxLoading key={`irrelevant-${i}`} />
                    ))
                : channelsGroups.map((group) => (
                    <TopicBox
                      key={group.id}
                      topicGroup={group}
                      courseCount={group.courses}
                      programCount={group.programs}
                    />
                  ))}
            </RootTopicList>
          </Grid>
        </Grid>
      </Container>
    </Page>
  )
}

export default TopicsListingPage
