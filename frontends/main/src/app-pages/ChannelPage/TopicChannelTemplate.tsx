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
import topicBannerDefault from "@/public/images/backgrounds/bg-default-topics.jpg"
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
 * How deep the photograph runs before the hero is white.
 *
 * The design states this twice, as a share of two different heroes: 52.617%
 * of the 768px hero that carries a Featured row, and 100% of the 304px hero
 * that has nothing to feature. Those are 404px and 304px -- so it is a
 * distance, and the shorter hero only reads as "100%" because it ends before
 * that distance is up.
 *
 * Taking whichever comes first reproduces both exactly, and holds for the
 * heights in between as a channel's description and Featured row come and go.
 * A percentage alone would stretch the fade across the cards on a tall hero;
 * a length alone would still be mid-fade where a short one meets the search
 * area below it.
 */
const HERO_FADE_END = "min(404px, 100%)"

/** Softens the photograph band's own left edge -- see `HeroPhoto`. */
const HERO_PHOTO_EDGE_FADE = "linear-gradient(90deg, transparent 0%, #000 18%)"

/**
 * The hero, per the topic page design.
 *
 * The image stays data-driven: the channel's own configured banner, falling
 * back to the design's artwork when a channel has none. Either way it is a
 * photograph: see `HeroPhoto` for how it is placed and `HeroScrim` for the
 * white wash that makes it a backdrop.
 */
const TopicHero = styled.section(({ theme }) => ({
  position: "relative",
  backgroundColor: theme.custom.colors.white,
}))

/**
 * The photograph, on a band of its own as deep as the wash below it.
 *
 * The design's framing puts the lower part of the frame -- the floor, and the
 * figure walking at its right edge -- across the top of the hero. A
 * photograph covering the whole hero cannot be pushed up that far: it is only
 * as much taller than the hero as the crop allows, and on a hero carrying a
 * Featured row that is not nearly enough, which leaves the walking figure
 * below the wash and washed out of the picture.
 *
 * Giving the photograph its own band as deep as the wash is what frees the
 * crop, and it is also what keeps the scrim fading rather than concealing:
 * covering a band has no edges inside it at any viewport, and the edge along
 * its bottom is at the exact depth the wash finishes.
 *
 * The band stops short of the left edge, which is what sets the scale: the
 * design draws the photograph three quarters of the hero wide, and covering
 * the full width instead renders it a third larger than that.
 *
 * That leaves one edge the wash cannot be relied on to cover. The wash comes
 * in at a slight angle, so the depth at which it reaches white is not a
 * single column: across the band it ranges over about five percent of the
 * width, and at the top it falls short of the band's edge. Rather than give
 * up the scale to chase it, the band fades its own left edge out, which holds
 * whatever the wash is doing behind it.
 */
const HeroPhoto = styled.div<{ backgroundUrl: string }>(
  ({ backgroundUrl }) => ({
    position: "absolute",
    top: 0,
    left: "24%",
    right: 0,
    height: HERO_FADE_END,
    pointerEvents: "none",
    backgroundImage: backgroundUrl,
    backgroundSize: "cover",
    /* Anchored right so the walking figure stays at the edge of the page, and
     low, which is the part of the frame the design uses. */
    backgroundPosition: "right 97%",
    maskImage: HERO_PHOTO_EDGE_FADE,
    WebkitMaskImage: HERO_PHOTO_EDGE_FADE,
    backgroundRepeat: "no-repeat",
  }),
)

/**
 * The white wash over the photo, as its own layer rather than extra values on
 * the hero's `background-image`.
 *
 * That is how the design builds it -- a photograph with two gradients over it
 * -- and it keeps the hero's own `background-image` to the single `url()` the
 * channel configured, which is what the page's tests look for.
 *
 * Both gradients start fully transparent, so the photograph reads at full
 * strength where they have not yet closed over it: the first draws white in
 * from the left, behind the text, and the second draws it down from the top
 * over `HERO_FADE_END`, finishing exactly where the photograph's band ends.
 */
const HeroScrim = styled.div({
  position: "absolute",
  inset: 0,
  pointerEvents: "none",
  backgroundImage: [
    "linear-gradient(259.54deg, rgba(255, 255, 255, 0) 33.745%, rgb(255, 255, 255) 74.054%)",
    `linear-gradient(180deg, rgba(255, 255, 255, 0) calc(${HERO_FADE_END} * 0.0489), rgb(255, 255, 255) ${HERO_FADE_END})`,
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
    boxShadow: "0 1px 3px 0 rgba(120, 147, 172, 0.40)",
    ...theme.typography.subtitle2,
    ":hover:not(:disabled)": {
      backgroundColor: theme.custom.colors.lightGray2,
      color: theme.custom.colors.darkGray2,
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
const BannerArea = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: "32px",
  maxWidth: "736px",
  /**
   * A channel with nothing featured has no row beneath the banner, and the
   * design opens the trail-to-title gap to 32px there -- a 304px hero rather
   * than a 752px one, so the text has room to sit in.
   *
   * Keyed off being the only child rather than off a flag: the Featured row
   * renders nothing at all when the channel features nothing, so "no sibling"
   * and "no featured row" are the same condition, and the two cannot drift.
   */
  "&:only-child": {
    gap: "32px",
  },
  /* The shared Breadcrumbs carries its own 16px bottom padding, which here
     would stack with this 16px gap and set the title 32px below the trail
     instead of the design's 16. */
  "> span": {
    paddingBottom: 0,
  },
  /**
   * The design greys the last step of the trail and sets it in the regular
   * weight. Breadcrumbs does that only for a step with nowhere to go; this
   * one leads to the parent topic, and the link is worth keeping, so it is
   * styled to match rather than flattened into plain text.
   */
  "> span > span:last-of-type": {
    "&, a, a:hover": {
      ...theme.typography.body3,
      color: theme.custom.colors.silverGrayDark,
    },
  },
}))

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
  width: "90%",
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
      <TopicHero>
        <HeroPhoto
          aria-hidden
          backgroundUrl={
            configuredBanner
              ? `url(${configuredBanner})`
              : backgroundSrcSetCSS(topicBannerDefault)
          }
        />
        <HeroScrim aria-hidden />
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
              <TopicFeaturedCarousel name={channel.name} />
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
