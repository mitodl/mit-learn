import { RiCheckboxCircleFill, RiCheckboxCircleLine } from "@remixicon/react"
import React from "react"
import {
  styled,
  Breadcrumbs,
  Container,
  Typography,
  Skeleton,
  BreadcrumbsProps,
  standardizeBackgroundUrl,
} from "ol-components"
import { SearchSubscriptionToggle } from "@/page-components/SearchSubscriptionToggle/SearchSubscriptionToggle"
import { useChannelDetail } from "api/hooks/channels"
import { SourceTypeEnum } from "api"
import { HOME as HOME_URL } from "../../common/urls"
import { CHANNEL_TYPE_BREADCRUMB_TARGETS } from "./ChannelPageTemplate"
import { ChannelTypeEnum, TopicChannel, DepartmentChannel } from "api/v0"
import { useLearningResourceTopic } from "api/hooks/learningResources"
import invariant from "tiny-invariant"
import type { FeaturedChannelType } from "./topicFeatured"
import TopicFeaturedCarousel from "./TopicFeaturedCarousel"
import { backgroundSrcSetCSS } from "ol-utilities"
import { DEPARTMENT_BANNERS } from "./departmentBanners"

const BannerSkeleton = styled(Skeleton)(({ theme }) => ({
  backgroundColor: theme.custom.colors.lightGray2,
}))

/**
 * The hero, per the department design.
 *
 * White, with the department's photograph laid over its top right -- see
 * `HeroPhoto`. There is no wash over the picture and no outline drawn around
 * it any more: the artwork arrives cut to the diagonal the design draws and
 * carries the hairline outside that cut itself, so both edges are the image's
 * own and the hero has nothing left to draw over it.
 */
const TopicHero = styled.section(({ theme }) => ({
  position: "relative",
  backgroundColor: theme.custom.colors.white,
}))

/**
 * What clips the photograph to the hero.
 *
 * The picture is taller than the shorter hero a channel with nothing to
 * feature leaves, and is let run off the bottom of it rather than shrink to
 * fit, so something has to cut it off at the hero's edge.
 */
const HeroPhotoClip = styled.div({
  position: "absolute",
  inset: 0,
  overflow: "hidden",
  pointerEvents: "none",
})

/**
 * How wide the photograph is drawn, as a share of the hero.
 *
 * The design draws it 922 of the hero's 1676 and takes it to the right edge.
 * A share rather than the artwork's own 920 pixels, so it holds that much of
 * the page at every width instead of shrinking to a stamp in the corner of a
 * wide one.
 */
const HERO_PHOTO_WIDTH = "55%"

/**
 * The artwork's own box, and how much of that box is the photograph.
 *
 * The outline the design runs outside the cut edge is part of the artwork now,
 * which makes the file larger than the picture in it: 32px down the left for
 * the outline and the gap it keeps from the cut, 29px below for its foot. The
 * picture still occupies the top right 920 x 494.
 */
const HERO_PHOTO_ART = { width: 952, height: 523, pictureWidth: 920 }

/**
 * The artwork drawn so that the picture inside it lands on the share above.
 *
 * Scaling the file to that share directly would draw the picture narrower by
 * exactly the margin, so the share is widened in the same proportion and the
 * margin hangs off the picture's left, which is where the design has it.
 */
const HERO_PHOTO_ART_WIDTH = `${
  (parseFloat(HERO_PHOTO_WIDTH) * HERO_PHOTO_ART.width) /
  HERO_PHOTO_ART.pictureWidth
}%`

/**
 * The photograph behind a department's title.
 *
 * One placement for every department, which is what the artwork being cut to
 * a single size buys: there is nothing left for a department to state. It is
 * anchored to the hero's top right corner at its own proportions -- the
 * diagonal down its left side and the outline beyond it are part of the image,
 * so stretching it would bend the two edges the design is precise about.
 */
const HeroPhoto = styled.div<{ backgroundUrl: string }>(
  ({ backgroundUrl }) => ({
    position: "absolute",
    top: "-2px",
    right: 0,
    width: HERO_PHOTO_ART_WIDTH,
    aspectRatio: `${HERO_PHOTO_ART.width} / ${HERO_PHOTO_ART.height}`,
    pointerEvents: "none",
    backgroundImage: backgroundUrl,
    backgroundRepeat: "no-repeat",
    /* Artwork cut to the box's own shape fills it either way; `cover` is for
       the departments not recut yet, which it crops rather than ruling white
       bands down the sides of. */
    backgroundSize: "cover",
    backgroundPosition: "top right",
  }),
)

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
/**
 * The tick once following: filled, and green rather than the pill's grey.
 *
 * The design system's own Green, which the published token set does not carry
 * -- its `green` is a darker #008000 and `darkGreen` darker again, and against
 * the pill's near-white neither reads as the design's.
 *
 * Repeated four times because `FollowPill` colours every icon inside it, and
 * does it again on hover: that rule names the pill, the hover, the not-
 * disabled and the svg, so three doubled classes still lose to it and the
 * tick would go grey under the pointer. Four of them outweigh its three.
 */
const FollowingIcon = styled(RiCheckboxCircleFill)({
  "&&&&": {
    color: "#00ad00",
  },
})

const FollowPill = styled.span(({ theme }) => ({
  /* Part of the title's inline flow rather than a box set beside it, so that
     the pill follows the title's last word -- see `TitleRow`.

     Bottom-aligned, as the design has it: the pill sits on the title's
     baseline rather than centred against its 60px cap height. `bottom` is the
     line box's bottom, which is where the flex row's `flex-end` put it, so a
     title short enough to share its line is drawn exactly as before. */
  display: "inline-block",
  verticalAlign: "center",
  marginLeft: "20px",
  /* Holds the pill clear of the title's descenders on the widths where even
     the last line leaves no room beside it. The title's 60px line box has room
     for the pill and this margin both, so it costs nothing -- moves nothing --
     on a line the pill does share. */
  marginTop: "20px",
  [theme.breakpoints.down("sm")]: {
    /* The narrow layout spaces these itself -- see `TitleRow`. */
    margin: 0,
  },
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

/* 48 above, 64 below, and 64 or 40 between the title block and the featured
   row -- see `updatedSpacing` on the hero's props. */
const HeroInner = styled("div", {
  shouldForwardProp: (prop) => prop !== "updatedSpacing",
})<{ updatedSpacing: boolean }>(({ theme, updatedSpacing }) => ({
  display: "flex",
  flexDirection: "column",
  gap: updatedSpacing ? "40px" : "64px",
  paddingTop: "48px",
  paddingBottom: "64px",
  [theme.breakpoints.down("sm")]: {
    gap: "16px",
    paddingTop: "24px",
    paddingBottom: "32px",
  },
}))

/**
 * What the breadcrumb and the description sit on, on a narrow screen.
 *
 * A phone has no column clear of the photograph -- the text runs the full
 * width, straight across it -- so the design gives each of them a pane of its
 * own to be read against: white at three quarters, which lifts the words off
 * the photograph while leaving it visible underneath.
 *
 * Only where there is a photograph. A hero that is plain white already reads,
 * and a white pane on white draws a box around the words for nothing.
 */
const HERO_TEXT_PANEL = {
  backgroundColor: "rgba(255, 255, 255, 0.75)",
  padding: "8px",
  borderRadius: "8px",
} as const

/**
 * Held to 736px, as the design has it: the description is a paragraph to read,
 * and the full container width would run it to an uncomfortable measure.
 */
const BannerArea = styled("div", {
  shouldForwardProp: (prop) =>
    prop !== "overPhoto" && prop !== "updatedSpacing",
})<{ overPhoto: boolean; updatedSpacing: boolean }>(
  ({ theme, overPhoto, updatedSpacing }) => ({
    display: "flex",
    flexDirection: "column",
    /* The older design draws this at 16px where a Featured row follows and
     32px where none does; we hold it at 32px throughout, so the trail sits the
     same distance from the title whether or not the channel features anything.
     The updated one settles it at 24px either way. */
    gap: updatedSpacing ? "24px" : "32px",
    maxWidth: "100%",
    /* The shared Breadcrumbs carries its own 16px bottom padding, which would
     stack with that gap and push the title further from the trail than any
     of the design's spacings. */
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
    [theme.breakpoints.down("sm")]: {
      gap: "16px",
      maxWidth: "100%",
    },
    /* The 8px here replaces the zeroed bottom padding above, which is why this
     follows it rather than sitting with the other narrow-screen rules. */
    ...(overPhoto
      ? { [theme.breakpoints.down("sm")]: { "> span": HERO_TEXT_PANEL } }
      : {}),
  }),
)

const TitleBlock = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: "32px",
  [theme.breakpoints.down("sm")]: {
    gap: "16px",
  },
}))

/**
 * One inline flow holding the title and the Follow pill, so that the pill
 * follows the end of the title's text rather than the edge of its box.
 *
 * A flex row cannot do that. It wraps on an item's max-content width, and a
 * title long enough to wrap is by definition wider than the row it is in, so
 * the pill was pushed onto a flex line of its own and came to rest under the
 * title's first letter -- a whole line below where the design has it, with the
 * end of the title left bare. Shrinking the title instead to hold the pill
 * beside it only moves the problem: the title then breaks earlier than it
 * needs to, and the pill stands off the edge of a box the shortened last line
 * no longer reaches.
 *
 * Nothing here draws, so the rules are on the two children: the title is
 * `display: inline` to put its text in this flow, and the pill is an
 * inline-block that follows it. They stay siblings rather than the pill
 * becoming the title's child, which would fold "Follow" into the heading's
 * accessible name.
 *
 * The narrow layout keeps the flex row, which blockifies both children again.
 * There the title drops to the h3 scale, whose 36px line box stands only 4px
 * taller than the pill: a pill that had to leave the line would come to rest
 * on the title's descenders, and the margin that would hold it clear is paid
 * for in space above the title instead, the line box having no room to absorb
 * it. A flex row's `row-gap` costs nothing, and a title that long on a phone
 * fills the width anyway, so there is rarely a last line to follow.
 */
const TitleRow = styled.div(({ theme }) => ({
  textWrap: "pretty",
  [theme.breakpoints.down("sm")]: {
    display: "flex",
    gap: "20px",
    alignItems: "flex-end",
    flexWrap: "wrap",
  },
}))

/**
 * An `h1` element, not a styled `Typography`: `styled()` drops MUI's
 * polymorphic `component` prop, so a styled Typography cannot be told which
 * element to be -- and the page's heading outline depends on this being the
 * level-1 heading. The type scale comes from the theme instead.
 */
const TopicTitle = styled.h1<{ compact: boolean }>(({ theme, compact }) => ({
  ...(compact ? theme.typography.h2 : theme.typography.h1),
  color: theme.custom.colors.lightRed,
  margin: 0,
  /* So the Follow pill can follow the last word -- see `TitleRow`. The heading
     is still a heading: display says how it is drawn, not what it is, and the
     narrow layout's flex row makes a block of it again. */
  display: "inline",
  [theme.breakpoints.down("sm")]: {
    ...theme.typography.h3,
  },
}))

/**
 * The design's Body/P1 is 16/26, while the shipped theme's `body1` is 16/20 --
 * the design file and the design system have drifted apart on this token. The
 * line height is set here to the design's, so the paragraph reads as drawn.
 */
const TopicDescription = styled(Typography, {
  shouldForwardProp: (prop) => prop !== "overPhoto",
})<{ overPhoto: boolean }>(({ theme, overPhoto }) => ({
  color: theme.custom.colors.darkGray2,
  lineHeight: "26px",
  width: "90%",
  [theme.breakpoints.down("sm")]: {
    width: "100%",
    ...theme.typography.body2,
    lineHeight: "22px",
    ...(overPhoto ? HERO_TEXT_PANEL : {}),
  },
}))

/**
 * The catalogue below the hero, on its own ground so the curated row above it
 * reads as a separate thing. The rule along the top is the design's divider.
 */
const SearchArea = styled.div(({ theme }) => ({
  borderTop: `1px solid ${theme.custom.colors.lightRed}`,
  backgroundColor: theme.custom.colors.lightGray1,
}))

const BreadcrumbsInternal: React.FC<
  Pick<BreadcrumbsProps, "current" | "currentHref"> & {
    channelType: FeaturedChannelType
  }
> = ({ channelType, ...props }) => {
  return (
    /* "light" is the variant for a light ground: black links over the
       channel's own silverGrayDark current page, which is what the design
       draws. "dark" renders them white, which the hero's pale wash would
       swallow. */
    <Breadcrumbs
      variant="light"
      separatorStyle={{ margin: "0 0 0 0" }}
      ancestors={[
        { href: HOME_URL, label: "Home" },
        {
          href: CHANNEL_TYPE_BREADCRUMB_TARGETS[channelType].href,
          label: CHANNEL_TYPE_BREADCRUMB_TARGETS[channelType].label,
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
      <TopicChannelHero channel={channel.data}>{children}</TopicChannelHero>
    )
  } else return null
}

/**
 * The topic hero, which the updated design draws on plain white.
 *
 * It used to carry a photograph; the design no longer does, so nothing is
 * passed behind the words and the section's own white is the ground. The
 * department hero still draws one -- see `DepartmentChannelHero`.
 *
 * Its own component only to hold the topic query, which decides whether the
 * trail is drawn or stood in for: a hook, so it cannot be called from the
 * shared hero, which a department renders without it.
 */
const TopicChannelHero: React.FC<{
  channel: TopicChannel
  children: React.ReactNode
}> = ({ channel, children }) => {
  invariant(channel.topic_detail.topic, "Topic channel must have a topic")
  const topicQuery = useLearningResourceTopic(channel.topic_detail.topic)

  return (
    <ChannelRedesignHero
      channel={channel}
      channelType={ChannelTypeEnum.Topic}
      updatedSpacing
      trailLoading={topicQuery.isLoading}
    >
      {children}
    </ChannelRedesignHero>
  )
}

/**
 * A channel's configured banner image, with the wash that takes it off the
 * rest of the hero.
 *
 * The topic page drew one until the design dropped the photograph; what is
 * left renders it for the departments that have artwork of their own -- see
 * `DEPARTMENT_BANNERS`.
 *
 * Takes the banner it is given and nothing else: the default artwork that
 * stood in for an unconfigured topic was the topic design's, and a channel
 * with nothing of its own now draws none.
 */
const ChannelHeroPhoto: React.FC<{
  configuredBanner: string
}> = ({ configuredBanner }) => (
  <HeroPhotoClip aria-hidden>
    <HeroPhoto
      data-testid="channel-hero-photo"
      /* Through the same standardizer the other channel banners use: the
         field holds either a bare src or a value already written as
         `url(...)`, and wrapping the second kind again drops it. */
      backgroundUrl={standardizeBackgroundUrl(configuredBanner)}
    />
  </HeroPhotoClip>
)

/**
 * The department hero, which draws the department's own artwork where there
 * is any and stands on plain white where there is not.
 */
const DepartmentChannelHero: React.FC<{
  channel: DepartmentChannel
  children: React.ReactNode
}> = ({ channel, children }) => {
  const banner = DEPARTMENT_BANNERS[channel.name]

  return (
    <ChannelRedesignHero
      channel={channel}
      channelType={ChannelTypeEnum.Department}
      compactTitle
      /* Both of these go with the photograph: without one there is nothing
         for the words to be lifted off, and the hero is white. */
      overPhoto={!!banner}
      background={
        banner ? (
          <ChannelHeroPhoto configuredBanner={backgroundSrcSetCSS(banner)} />
        ) : undefined
      }
    >
      {children}
    </ChannelRedesignHero>
  )
}

/**
 * The same page for an academic department.
 *
 * The design is the topic page's but for the hero's ground: a department that
 * has artwork in `DEPARTMENT_BANNERS` draws it behind the title, where the
 * revised topic design has none at all.
 */
const DepartmentChannelTemplate: React.FC<TopicChannelTemplateProps> = ({
  children,
  name,
}) => {
  const channel = useChannelDetail(
    String(ChannelTypeEnum.Department),
    String(name),
  )
  if (channel.data?.channel_type === ChannelTypeEnum.Department) {
    return (
      <DepartmentChannelHero channel={channel.data}>
        {children}
      </DepartmentChannelHero>
    )
  } else return null
}

type ChannelRedesignHeroProps = {
  channel: TopicChannel | DepartmentChannel
  channelType: FeaturedChannelType
  children: React.ReactNode
  /**
   * The layers behind the words, where there are any. A topic hero puts its
   * photograph and the wash over it here; a department has neither, and the
   * section's own white is the ground.
   */
  background?: React.ReactNode
  /** Whether that background is a photograph the words need lifting off. */
  overPhoto?: boolean
  /** Shown in the trail's place until the channel's own detail is in hand. */
  trailLoading?: boolean
  /**
   * The updated design's spacings: 24px under the trail and 40px above the
   * Featured row, where the original has 32px and 64px.
   *
   * A prop rather than the one answer because only the topic design has been
   * revised -- Figma 47770-73639 against the department's 46398-102688 -- and
   * the department page is to keep what it has, banner image included, until
   * its own design catches up.
   */
  updatedSpacing?: boolean
  /**
   * The title at the department design's Headline/H2 -- 34/40 -- rather than
   * the H1 the topic design draws it at.
   *
   * A prop for the same reason the spacings are: the two designs differ on it
   * and only the department's has been read for this. It is not a detail: at
   * 52px a name like "Urban Studies and Planning" is 695px of a 736px row,
   * which puts the Follow pill on a line of its own and makes the hero 72px
   * deeper than the design draws it -- which in turn is what the banner
   * placements are measured against.
   */
  compactTitle?: boolean
}

/**
 * The hero and the catalogue beneath it, which the redesigned topic and
 * department pages share.
 *
 * Everything but the ground is the same page: the trail, the red title, the
 * Follow pill beside it, an optional description, the curated Featured row,
 * and the search area below the rule.
 */
const ChannelRedesignHero: React.FC<ChannelRedesignHeroProps> = ({
  channel,
  channelType,
  children,
  background,
  overPhoto = false,
  trailLoading = false,
  updatedSpacing = false,
  compactTitle = false,
}) => {
  const urlParams = new URLSearchParams(channel.search_filter)

  return (
    <>
      <TopicHero>
        {background}
        <HeroContent>
          <Container>
            <HeroInner updatedSpacing={updatedSpacing}>
              <BannerArea overPhoto={overPhoto} updatedSpacing={updatedSpacing}>
                {trailLoading ? (
                  <BannerSkeleton variant="text" width="33%" />
                ) : (
                  <BreadcrumbsInternal
                    channelType={channelType}
                    current={channel.title}
                  />
                )}
                <TitleBlock>
                  <TitleRow>
                    <TopicTitle compact={compactTitle}>
                      {channel.title}
                    </TopicTitle>
                    {channel.search_filter ? (
                      <FollowPill>
                        <SearchSubscriptionToggle
                          itemName={channel.title}
                          sourceType={SourceTypeEnum.ChannelSubscriptionType}
                          searchParams={urlParams}
                          icon={<RiCheckboxCircleLine aria-hidden />}
                          subscribedIcon={<FollowingIcon aria-hidden />}
                        />
                      </FollowPill>
                    ) : null}
                  </TitleRow>
                  {channel.public_description ? (
                    <TopicDescription variant="body1" overPhoto={overPhoto}>
                      {channel.public_description}
                    </TopicDescription>
                  ) : null}
                </TitleBlock>
              </BannerArea>
              <TopicFeaturedCarousel
                name={channel.name}
                channelType={channelType}
              />
            </HeroInner>
          </Container>
        </HeroContent>
      </TopicHero>
      {/* What the results are spaced from is the rule this draws, and the
          column below sets its own distance from it -- see `SearchDisplay`. */}
      <SearchArea>{children}</SearchArea>
    </>
  )
}

export default TopicChannelTemplate
export { DepartmentChannelTemplate, ChannelHeroPhoto }
