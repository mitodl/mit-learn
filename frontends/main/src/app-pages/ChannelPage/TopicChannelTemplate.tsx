import React from "react"
import {
  styled,
  Breadcrumbs,
  Banner,
  ChipLink,
  Typography,
  Skeleton,
  BreadcrumbsProps,
} from "ol-components"
import { SearchSubscriptionToggle } from "@/page-components/SearchSubscriptionToggle/SearchSubscriptionToggle"
import { useChannelDetail } from "api/hooks/channels"
import ChannelMenu from "@/components/ChannelMenu/ChannelMenu"
import ChannelAvatar from "@/components/ChannelAvatar/ChannelAvatar"
import { LearningResourceTopic, SourceTypeEnum } from "api"
import { HOME as HOME_URL } from "../../common/urls"
import {
  CHANNEL_TYPE_BREADCRUMB_TARGETS,
  ChannelControls,
} from "./ChannelPageTemplate"
import { ChannelTypeEnum, TopicChannel } from "api/v0"
import {
  useLearningResourceTopic,
  useLearningResourceTopics,
} from "api/hooks/learningResources"
import { propsNotNil, backgroundSrcSetCSS } from "ol-utilities"
import invariant from "tiny-invariant"
import backgroundSteps from "@/public/images/backgrounds/background_steps.jpg"
import { usePostHog } from "posthog-js/react"
import { PostHogEvents } from "@/common/constants"

const ChildrenContainer = styled.div(({ theme }) => ({
  paddingTop: "40px",
  [theme.breakpoints.down("sm")]: {
    paddingTop: "24px",
  },
}))

const ChannelControlsContainer = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  alignItems: "end",
  flexGrow: 0,
  flexShrink: 0,
  [theme.breakpoints.down("xs")]: {
    width: "100%",
  },
  [theme.breakpoints.down("sm")]: {
    mt: "8px",
    mb: "48px",
  },
  [theme.breakpoints.up("md")]: {
    mt: "0px",
    mb: "48px",
    width: "15%",
  },
}))

const SubTopicsContainer = styled.div(({ theme }) => ({
  paddingTop: "30px",
  [theme.breakpoints.down("md")]: {
    paddingTop: "16px",
    paddingBottom: "16px",
  },
}))

const SubTopicsHeader = styled(Typography)(({ theme }) => ({
  marginBottom: "16px",
  ...theme.typography.subtitle1,
}))

const ChipsContainer = styled.div({
  display: "flex",
  flexWrap: "wrap",
  gap: "12px",
})

const BannerSkeleton = styled(Skeleton)(({ theme }) => ({
  backgroundColor: theme.custom.colors.darkGray2,
}))

type TopicChipsInternalProps = {
  topicId: number
  parentTopicId: number
  isTopLevelTopic: boolean
}

const TopicChipsInternal: React.FC<TopicChipsInternalProps> = (props) => {
  const posthog = usePostHog()
  const { topicId, parentTopicId, isTopLevelTopic } = props
  const title = isTopLevelTopic ? "Subtopics" : "Related Topics"
  const posthogEvent = isTopLevelTopic
    ? PostHogEvents.SubTopicClicked
    : PostHogEvents.RelatedTopicClicked
  const subTopicsQuery = useLearningResourceTopics({
    parent_topic_id: [parentTopicId],
  })
  const topics = subTopicsQuery.data?.results
    ?.filter(propsNotNil(["channel_url"]))
    .filter((t) => t.id !== topicId)
  const totalTopics = topics?.length ?? 0
  return totalTopics > 0 ? (
    <SubTopicsContainer>
      <SubTopicsHeader data-testid="sub-topics-header">{title}</SubTopicsHeader>
      <ChipsContainer>
        {topics?.map((topic) => (
          <ChipLink
            size="large"
            variant="darker"
            key={topic.id}
            href={topic.channel_url ?? ""}
            onClick={() => {
              if (process.env.NEXT_PUBLIC_POSTHOG_API_KEY) {
                posthog.capture(posthogEvent, { topic })
              }
            }}
            label={topic.name}
          />
        ))}
      </ChipsContainer>
    </SubTopicsContainer>
  ) : null
}

type TopicChipsProps = {
  topic: LearningResourceTopic | null | undefined
}

const TopicChips: React.FC<TopicChipsProps> = (props) => {
  const { topic } = props
  if (!topic) {
    return null
  }
  const isTopLevelTopic = topic?.parent === null
  const parentTopicId = isTopLevelTopic ? topic.id : topic?.parent

  if (parentTopicId) {
    return (
      <TopicChipsInternal
        topicId={topic.id}
        parentTopicId={parentTopicId}
        isTopLevelTopic={isTopLevelTopic}
      />
    )
  }
}

type SubTopicBreadcrumbsProps = {
  topic: LearningResourceTopic | undefined
  parentTopicId: number
}

const SubTopicBreadcrumbs: React.FC<SubTopicBreadcrumbsProps> = (props) => {
  const { topic, parentTopicId } = props
  const parentTopic = useLearningResourceTopic(parentTopicId).data
  if (!topic?.parent) {
    return null
  }
  return (
    <BreadcrumbsInternal
      current={parentTopic?.name}
      currentHref={parentTopic?.channel_url}
    />
  )
}

const BreadcrumbsInternal: React.FC<
  Pick<BreadcrumbsProps, "current" | "currentHref">
> = (props) => {
  return (
    <Breadcrumbs
      variant="dark"
      ancestors={[
        { href: HOME_URL, label: "Home" },
        {
          href: CHANNEL_TYPE_BREADCRUMB_TARGETS[ChannelTypeEnum.Topic].href,
          label: CHANNEL_TYPE_BREADCRUMB_TARGETS[ChannelTypeEnum.Topic].label,
        },
      ]}
      current={props.current}
      currentHref={props.currentHref}
    />
  )
}

interface TopicChannelTemplateProps {
  children: React.ReactNode
  name: string
}

/**
 * Common structure for topic channel-oriented pages.
 *
 * Renders the channel title and avatar in a banner.
 */
const TopicChannelTemplate: React.FC<TopicChannelTemplateProps> = ({
  children,
  name,
}) => {
  const channel = useChannelDetail(String(ChannelTypeEnum.Topic), String(name))
  if (channel.data?.channel_type === ChannelTypeEnum.Topic) {
    return (
      <TopicChannelTemplateInternal channel={channel.data} name={name}>
        {children}
      </TopicChannelTemplateInternal>
    )
  } else return null
}

type TopicChannelTemplateInternalProps = {
  channel: TopicChannel
  name: string
  children: React.ReactNode
}

const TopicChannelTemplateInternal: React.FC<
  TopicChannelTemplateInternalProps
> = ({ channel, name, children }) => {
  invariant(channel.topic_detail.topic, "Topic channel must have a topic")
  const topicQuery = useLearningResourceTopic(channel.topic_detail.topic)
  const topicQueryLoading = topicQuery.isLoading
  const topic = topicQuery.data
  const parentTopicId = topic?.parent
  const urlParams = new URLSearchParams(channel.search_filter)
  const displayConfiguration = channel.configuration
  const navText = parentTopicId ? (
    <SubTopicBreadcrumbs topic={topic} parentTopicId={parentTopicId} />
  ) : (
    <BreadcrumbsInternal current={channel.title} />
  )

  return (
    <>
      <Banner
        navText={
          topicQueryLoading ? (
            <BannerSkeleton variant="text" width="33%" />
          ) : (
            navText
          )
        }
        avatar={
          displayConfiguration?.logo &&
          channel && (
            <ChannelAvatar
              imageVariant="inverted"
              formImageUrl={displayConfiguration.logo}
              imageSize="medium"
              channel={channel}
            />
          )
        }
        title={channel.title}
        header={displayConfiguration?.heading}
        subHeader={displayConfiguration?.sub_heading}
        extraHeader={<TopicChips topic={topic} />}
        backgroundUrl={
          displayConfiguration?.banner_background ??
          backgroundSrcSetCSS(backgroundSteps)
        }
        extraActions={
          <ChannelControlsContainer>
            <ChannelControls>
              {channel.search_filter ? (
                <SearchSubscriptionToggle
                  itemName={channel.title}
                  sourceType={SourceTypeEnum.ChannelSubscriptionType}
                  searchParams={urlParams}
                />
              ) : null}
              {channel.is_moderator ? (
                <ChannelMenu
                  channelType={String(ChannelTypeEnum.Topic)}
                  name={String(name)}
                />
              ) : null}
            </ChannelControls>
          </ChannelControlsContainer>
        }
      />
      <ChildrenContainer>{children}</ChildrenContainer>
    </>
  )
}

export default TopicChannelTemplate
