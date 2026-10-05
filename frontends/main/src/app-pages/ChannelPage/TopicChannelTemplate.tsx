import { RiCheckboxCircleLine } from "@remixicon/react"
import React from "react"
import {
  styled,
  Breadcrumbs,
  Container,
  Typography,
  Skeleton,
  BreadcrumbsProps,
} from "ol-components"
import { SearchSubscriptionToggle } from "@/page-components/SearchSubscriptionToggle/SearchSubscriptionToggle"
import { useChannelDetail } from "api/hooks/channels"
import { LearningResourceTopic, SourceTypeEnum } from "api"
import { HOME as HOME_URL } from "../../common/urls"
import { CHANNEL_TYPE_BREADCRUMB_TARGETS } from "./ChannelPageTemplate"
import { ChannelTypeEnum, TopicChannel } from "api/v0"
import { useLearningResourceTopic } from "api/hooks/learningResources"
import { backgroundSrcSetCSS } from "ol-utilities"
import invariant from "tiny-invariant"
import topicBannerDefault from "@/public/images/backgrounds/topic_banner_default.jpg"
import TopicFeaturedCarousel from "./TopicFeaturedCarousel"

const ChildrenContainer = styled.div(({ theme }) => ({
  /* The design sets the search card 64px below the hero. */
  paddingTop: "64px",
  [theme.breakpoints.down("sm")]: {
    paddingTop: "24px",
  },
}))

const BannerSkeleton = styled(Skeleton)(({ theme }) => ({
  backgroundColor: theme.custom.colors.lightGray2,
}))

/**
 * The hero, per the topic page design.
 *
 * The image stays data-driven: the channel's own configured banner, falling
 * back to the design's artwork when a channel has none. A white wash over the
 * photo is what lifts the text off it and fades the section into the white
 * above the search area -- see `HeroScrim`, which supplies that wash for a
 * configured photo. The default artwork already carries it.
 */
const TopicHero = styled.section<{ backgroundUrl: string }>(
  ({ theme, backgroundUrl }) => ({
    position: "relative",
    backgroundImage: backgroundUrl,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundColor: theme.custom.colors.white,
  }),
)

/**
 * The white wash over a channel's own photo, as its own layer rather than
 * extra values on the hero's `background-image`.
 *
 * That is how the design builds it -- an image with a gradient over it -- and
 * it keeps the hero's own `background-image` to the single `url()` the channel
 * configured, which is what the page's tests look for. The angles and stops
 * are the design's.
 */
const HeroScrim = styled.div({
  position: "absolute",
  inset: 0,
  pointerEvents: "none",
  backgroundImage: [
    "linear-gradient(204.88deg, rgba(255, 255, 255, 0.2) 29.863%, rgb(255, 255, 255) 94.101%)",
    "linear-gradient(180deg, rgba(255, 255, 255, 0.6) 0%, rgb(255, 255, 255) 53.125%)",
  ].join(", "),
})

/**
 * The Follow control as the design draws it: a grey pill, not the primary red
 * button the shared `SearchSubscriptionToggle` renders elsewhere.
 *
 * Styled from outside the component rather than by changing it, so Follow
 * keeps its usual look on every other page that has one. The numbers are the
 * design's: 4/16/4/8 padding, a 100px radius, 8px between icon and label.
 *
 * That padding around a 24px icon is what makes the design's 100x32 pill, so
 * the shared Button's own sizing has to give way: its 130px `min-width` would
 * stretch the pill, and it sizes its icon slot to the 14px its own small
 * variant uses, which leaves the 24px icon overflowing a short line box.
 */
const FollowPill = styled.div(({ theme }) => ({
  "button, a": {
    backgroundColor: theme.custom.colors.lightGray1,
    color: theme.custom.colors.silverGrayDark,
    borderColor: "transparent",
    borderRadius: "100px",
    padding: "4px 16px 4px 8px",
    gap: "8px",
    height: "32px",
    minHeight: "unset",
    minWidth: "unset",
    boxShadow: "none",
    ...theme.typography.subtitle2,
    ":hover:not(:disabled)": {
      backgroundColor: theme.custom.colors.lightGray2,
      color: theme.custom.colors.darkGray2,
      boxShadow: "none",
      svg: {
        color: theme.custom.colors.darkGray2,
      },
    },
    /**
     * The icon slot, which the Button sizes and nudges for its own smaller
     * icon: 14px square, pulled 4px left and pushed 8px right. Those margins
     * are what the padding and gap above are meant to set, so they come off
     * -- otherwise the icon sits 4px from the edge and 16px from the label,
     * where the design asks for 8 and 8.
     */
    "> span": {
      width: "24px",
      height: "24px",
      margin: 0,
    },
    svg: {
      display: "block",
      width: "24px",
      height: "24px",
      /* The design draws the check a shade lighter than its label, so the
         icon takes its own colour rather than inheriting the label's. */
      color: theme.custom.colors.silverGray,
    },
  },
}))

/* Above the scrim, which would otherwise wash out the text too. */
const HeroContent = styled.div({
  position: "relative",
})

/* 48 above, 64 below, and 64 between the title block and the featured row. */
const HeroInner = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: "64px",
  paddingTop: "48px",
  paddingBottom: "64px",
  [theme.breakpoints.down("sm")]: {
    gap: "32px",
    paddingTop: "24px",
    paddingBottom: "32px",
  },
}))

/**
 * Held to 736px, as the design has it: the description is a paragraph to read,
 * and the full container width would run it to an uncomfortable measure.
 */
const BannerArea = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "16px",
  maxWidth: "736px",
  /* The shared Breadcrumbs carries its own 16px bottom padding, which here
     would stack with this 16px gap and set the title 32px below the trail
     instead of the design's 16. */
  "> span": {
    paddingBottom: 0,
  },
})

const TitleBlock = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "32px",
})

/* Wraps rather than squeezing the title: the Follow control has a fixed size
   and a long topic name would otherwise crush it.

   Bottom-aligned, as the design has it -- the pill sits on the title's
   baseline rather than centred against a 60px cap height. */
const TitleRow = styled.div({
  display: "flex",
  gap: "20px",
  /* Bottom-aligned, as the design has it -- the pill sits on the title's
     baseline rather than centred against its 60px cap height. */
  alignItems: "center",
  flexWrap: "wrap",
})

/**
 * An `h1` element, not a styled `Typography`: `styled()` drops MUI's
 * polymorphic `component` prop, so a styled Typography cannot be told which
 * element to be -- and the page's heading outline depends on this being the
 * level-1 heading. The type scale comes from the theme instead.
 */
const TopicTitle = styled.h1(({ theme }) => ({
  ...theme.typography.h1,
  color: theme.custom.colors.lightRed,
  margin: 0,
}))

/**
 * The design's Body/P1 is 16/26, while the shipped theme's `body1` is 16/20 --
 * the design file and the design system have drifted apart on this token. The
 * line height is set here to the design's, so the paragraph reads as drawn.
 */
const TopicDescription = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.darkGray2,
  lineHeight: "26px",
}))

/**
 * The catalogue below the hero, on its own ground so the curated row above it
 * reads as a separate thing. The rule along the top is the design's divider.
 */
const SearchArea = styled.div(({ theme }) => ({
  borderTop: `1px solid ${theme.custom.colors.lightRed}`,
  backgroundColor: theme.custom.colors.lightGray1,
}))

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
    /* "light" is the variant for a light ground: black links over the topic's
       own silverGrayDark current page, which is what the design draws. "dark"
       renders them white, which the hero's pale wash would swallow. */
    <Breadcrumbs
      variant="light"
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
      <TopicChannelTemplateInternal channel={channel.data}>
        {children}
      </TopicChannelTemplateInternal>
    )
  } else return null
}

type TopicChannelTemplateInternalProps = {
  channel: TopicChannel
  children: React.ReactNode
}

const TopicChannelTemplateInternal: React.FC<
  TopicChannelTemplateInternalProps
> = ({ channel, children }) => {
  invariant(channel.topic_detail.topic, "Topic channel must have a topic")
  const topicQuery = useLearningResourceTopic(channel.topic_detail.topic)
  const topicQueryLoading = topicQuery.isLoading
  const topic = topicQuery.data
  const parentTopicId = topic?.parent
  const urlParams = new URLSearchParams(channel.search_filter)
  const displayConfiguration = channel.configuration
  const configuredBanner = displayConfiguration?.banner_background
  const navText = parentTopicId ? (
    <SubTopicBreadcrumbs topic={topic} parentTopicId={parentTopicId} />
  ) : (
    <BreadcrumbsInternal current={channel.title} />
  )

  return (
    <>
      <TopicHero
        backgroundUrl={
          configuredBanner
            ? `url(${configuredBanner})`
            : backgroundSrcSetCSS(topicBannerDefault)
        }
      >
        {/* The default artwork is the design's own composite, which carries
            the white wash in its pixels already. Laying the scrim over it too
            would wash it a second time, so the scrim is for a channel that
            brings its own photo. */}
        {configuredBanner ? <HeroScrim aria-hidden /> : null}
        <HeroContent>
          <Container>
            <HeroInner>
              <BannerArea>
                {topicQueryLoading ? (
                  <BannerSkeleton variant="text" width="33%" />
                ) : (
                  navText
                )}
                <TitleBlock>
                  <TitleRow>
                    <TopicTitle>{channel.title}</TopicTitle>
                    {channel.search_filter ? (
                      <FollowPill>
                        <SearchSubscriptionToggle
                          itemName={channel.title}
                          sourceType={SourceTypeEnum.ChannelSubscriptionType}
                          searchParams={urlParams}
                          icon={<RiCheckboxCircleLine aria-hidden />}
                        />
                      </FollowPill>
                    ) : null}
                  </TitleRow>
                  {channel.public_description ? (
                    <TopicDescription variant="body1">
                      {channel.public_description}
                    </TopicDescription>
                  ) : null}
                </TitleBlock>
              </BannerArea>
              <TopicFeaturedCarousel />
            </HeroInner>
          </Container>
        </HeroContent>
      </TopicHero>
      <SearchArea>
        <ChildrenContainer>{children}</ChildrenContainer>
      </SearchArea>
    </>
  )
}

export default TopicChannelTemplate
