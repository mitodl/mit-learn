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
import TopicFeaturedCarousel, {
  useTopicFeaturedIsEmpty,
} from "./TopicFeaturedCarousel"
import { backgroundSrcSetCSS } from "ol-utilities"
import type { StaticImageData } from "next/image"
import architectureBanner from "@/public/images/backgrounds/architecture.jpg"
import mediaArtsAndSciencesBanner from "@/public/images/backgrounds/media-arts-and-sciences.jpg"
import urbanStudiesAndPlanningBanner from "@/public/images/backgrounds/urban-studies-and-planning.jpg"
import aeronauticsAndAstronauticsBanner from "@/public/images/backgrounds/aeronautics-and-astronautics.jpg"
import biologicalEngineeringBanner from "@/public/images/backgrounds/biological-engineering.jpg"
import chemicalEngineeringBanner from "@/public/images/backgrounds/chemical-engineering.jpg"

const BannerSkeleton = styled(Skeleton)(({ theme }) => ({
  backgroundColor: theme.custom.colors.lightGray2,
}))

/**
 * Where the photograph sits, as the department design states it.
 *
 * The design lays the image out rather than cropping it to fill: 71.1% of the
 * hero wide, 134.59% of it tall, 28.88% from its left and lifted 28.85% above
 * its top. Those proportions are the artwork's own -- 1192x894 is 4:3, which
 * is what `architecture.jpg` is -- so what the numbers describe is a picture
 * placed at its natural shape and allowed to run off the top and bottom.
 *
 * Only two of those four can be kept once the hero is not the shape the frame
 * was: a picture holding its own proportions cannot be both 71.1% of a width
 * and 134.59% of a height unless the two stand in the same ratio as the
 * design's 1676x664. A hero is not that shape for long -- its width follows
 * the viewport while its height follows the content -- so this keeps the
 * height, and lets the width fall where it may.
 *
 * Keeping the height is what keeps the picture: the 34.59% it stands proud of
 * the hero is the crop, and the crop is the framing -- the sky off the top,
 * the road along the bottom. Keeping the width instead holds the picture's
 * edge where the design puts it and surrenders the crop, which at anything
 * narrower than 1676 zooms out until the building is a detail in a sky. The
 * width it gives up is covered by the wash, which is white across the left
 * where the words are; the crop has nothing covering it.
 *
 * `background-position` then says where the oversized image sits, as a share
 * of the overflow rather than a distance: -28.85 / (100 - 134.59) = 83.41%
 * down, and flush right, which is the design's 28.88% from the left once the
 * picture is as wide as this makes it.
 */
const HERO_PHOTO_SIZE = "auto 134.59%"
const HERO_PHOTO_POSITION = "100% 83.41%"

/**
 * Where the picture starts, which is the one thing the design does fix: the
 * left edge of the photograph, 28.88% across.
 */
const HERO_PHOTO_LEFT = "28.88%"

/**
 * Softens the band's own left edge.
 *
 * The wash comes in at an angle, so the depth at which it reaches white is
 * not a single column: at the top of the hero it is still short of where the
 * band begins, which leaves the picture ending in a ruled vertical line. The
 * band fades itself out instead, which holds whatever the wash is doing
 * behind it and at whatever width.
 */
const HERO_PHOTO_EDGE_FADE = "linear-gradient(90deg, transparent 0%, #000 22%)"

/**
 * Where a department's own artwork sits, where the design states it
 * differently from the values above.
 *
 * Those values are one photograph's: the design wrote them around a 4:3
 * picture, and they only hold for another of the same shape. A department
 * whose artwork is a different shape states its own frame, and gives the
 * three that say where the picture goes; the rest of the hero is unchanged.
 */
type BannerPlacement = {
  /** The left edge of the band the picture is drawn in. */
  left?: string
  /** `background-size` and `background-position` within it. */
  size?: string
  position?: string
  /**
   * Given together where the design states the picture's own box instead: how
   * far it is lifted above the hero, how wide it is drawn, and the shape it
   * keeps while being drawn that wide.
   */
  top?: string
  width?: string
  aspectRatio?: string
  /**
   * How far the box has to reach whatever its shape works out to, so that a
   * hero taller than the one the design was drawn on is still covered rather
   * than left with a strip of white under the picture.
   */
  minHeight?: string
  /**
   * The white wash, where the design angles it differently for this
   * photograph.
   *
   * It is drawn per department rather than once, because how far the white
   * may sweep across depends on where the picture starts: a wash written for
   * one that begins a third of the way across closes over one that begins
   * further right. Only the hero that carries a Featured row takes it -- the
   * short one is held back by a rule of its own, which no design states.
   */
  scrim?: string
}

type DepartmentBanner = BannerPlacement & { image: StaticImageData }

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
 * The photograph behind a department's title.
 *
 * Covers the hero and is clipped by it, with the placement stated above: the
 * design runs the image off the top and the bottom rather than fitting it,
 * and anchors it right so the hero's left is left for the words.
 */
/**
 * What clips the photograph to the hero.
 *
 * The design builds it this way -- a box the size of the hero with the
 * picture laid absolutely inside it -- and it is what lets the picture be
 * placed by its own edges rather than by how far it happens to overhang.
 * `background-position` can only say "this share of the overflow", which is a
 * different distance on every hero; a top stated here is the design's.
 */
const HeroPhotoClip = styled.div({
  position: "absolute",
  inset: 0,
  overflow: "hidden",
  pointerEvents: "none",
})

const HeroPhoto = styled.div<{
  backgroundUrl: string
  shortHero: boolean
  placement: BannerPlacement
}>(({ backgroundUrl, shortHero, placement }) => ({
  position: "absolute",
  inset: 0,
  left: placement.left ?? 0,
  /* Where the design states the picture's own box rather than a slice of the
     hero: the width is the hero's, the height follows the photograph's shape
     so nothing is stretched, and the top is the design's lift. */
  ...(placement.top
    ? {
        top: placement.top,
        bottom: "auto",
        width: placement.width,
        aspectRatio: placement.aspectRatio,
        minHeight: placement.minHeight,
      }
    : {}),
  pointerEvents: "none",
  backgroundImage: backgroundUrl,
  backgroundRepeat: "no-repeat",
  backgroundSize: placement.size ?? HERO_PHOTO_SIZE,
  backgroundPosition: placement.position ?? HERO_PHOTO_POSITION,
  /**
   * A hero with nothing to feature, which the design does not draw.
   *
   * Sizing by height is what keeps the crop on the hero that has a Featured
   * row, but on the short one it works the other way: a third again of
   * 300px is 400, and 400px of a 4:3 picture is 530 wide on a page three
   * times that -- the building shrinks to a stamp in the corner rather than
   * standing behind the title.
   *
   * So the picture is given the band the design starts it at -- everything
   * right of 28.88% -- and told to fill it.
   *
   * Which slice of it that leaves is then the only question, and the answer
   * is above the middle: centred, a band this shallow lands on the road and
   * the parked cars, with the building cut off at the sill. Taking it from
   * 30% puts the glass, the brickwork and the lettering across it and keeps
   * the tarmac out.
   */
  ...(shortHero
    ? {
        left: placement.left ?? HERO_PHOTO_LEFT,
        /* Back to a slice of the hero: there is no room on this one to hang a
           picture off, so whatever box the design states is set aside -- its
           floor included, which otherwise outlives the box it was a floor for
           and leaves the picture hanging past the bottom of a hero a third its
           height, cropping from a frame that is not the one on show. */
        top: 0,
        bottom: 0,
        width: "auto",
        aspectRatio: "auto",
        minHeight: "unset",
        backgroundSize: "cover",
        backgroundPosition: "center 30%",
        maskImage: HERO_PHOTO_EDGE_FADE,
        WebkitMaskImage: HERO_PHOTO_EDGE_FADE,
      }
    : {}),
}))

/**
 * The white wash over the photograph.
 *
 * One diagonal gradient, which is how the design builds it: transparent at
 * the top right where the picture is wanted, white by the time it reaches the
 * breadcrumb and the title at the left. Its own layer rather than another
 * value on the hero's `background-image`, so that stays the single `url()`
 * the page's tests look for.
 */
const HERO_SCRIM =
  "linear-gradient(210.596deg, rgba(255, 255, 255, 0) 6.9194%, rgb(255, 255, 255) 44.431%)"

/**
 * The same wash, held back, for the hero with nothing to feature.
 *
 * The design's stops are measured against a hero that carries a Featured row,
 * where the white has the depth of the cards to arrive over. On the short one
 * the same proportions arrive in a couple of hundred pixels, which closes the
 * white over the picture almost as soon as it starts -- and there is less
 * picture to lose, since it only begins at 28.88%.
 *
 * Starting the fade later and finishing it later leaves the photograph the
 * right-hand half of its own band and still reaches white before the title,
 * which sits left of where the band begins and never had the photograph
 * behind it to be lifted off.
 */
const HERO_SCRIM_SHORT =
  "linear-gradient(210.596deg, rgba(255, 255, 255, 0) 22%, rgb(255, 255, 255) 72%)"

const HeroScrim = styled.div<{ shortHero: boolean; scrim?: string }>(
  ({ shortHero, scrim }) => ({
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    backgroundImage: shortHero ? HERO_SCRIM_SHORT : (scrim ?? HERO_SCRIM),
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
    maxWidth: "736px",
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

/* Wraps rather than squeezing the title: the Follow control has a fixed size
   and a long topic name would otherwise crush it.

   Bottom-aligned, as the design has it -- the pill sits on the title's
   baseline rather than centred against a 60px cap height. */
const TitleRow = styled.div({
  display: "flex",
  gap: "20px",
  /* Bottom-aligned, as the design has it -- the pill sits on the title's
     baseline rather than centred against its 60px cap height. */
  alignItems: "flex-end",
  flexWrap: "wrap",
})

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
  /** Frames the shorter hero a channel with nothing to feature leaves. */
  featuredIsEmpty: boolean
  /** Empty for artwork the design's own values fit. */
  placement?: BannerPlacement
}> = ({ configuredBanner, featuredIsEmpty, placement = {} }) => (
  <>
    <HeroPhotoClip aria-hidden>
      <HeroPhoto
        data-testid="channel-hero-photo"
        shortHero={featuredIsEmpty}
        placement={placement}
        /* Through the same standardizer the other channel banners use: the
           field holds either a bare src or a value already written as
           `url(...)`, and wrapping the second kind again drops it. */
        backgroundUrl={standardizeBackgroundUrl(configuredBanner)}
      />
    </HeroPhotoClip>
    <HeroScrim
      aria-hidden
      shortHero={featuredIsEmpty}
      scrim={placement.scrim}
    />
  </>
)

/**
 * The artwork behind a department's title, by department.
 *
 * Keyed on the channel's `name` -- the slug the route carries and the API
 * returns -- rather than the title, which is prose and punctuated. Nothing is
 * configured on these channels to read instead: every department's
 * `banner_background` is empty, so this is the only thing that decides.
 *
 * A department with no entry here draws no photograph and stands on the plain
 * white the topic pages do, so this fills in one department at a time.
 */
const DEPARTMENT_BANNERS: Partial<Record<string, DepartmentBanner>> = {
  architecture: { image: architectureBanner },
  /**
   * Media Arts states its own box, and has to: the design gives this one the
   * hero's full width from 22.21% across, lifted 13.96% above the top, at
   * 1676x756 -- the 2.215 this photograph is, not the 4:3 the values above
   * were written around. Left on those it is drawn half as wide again as the
   * hero and hangs off the right.
   *
   * The shape is the photograph's, so the width settles the height; the floor
   * is the design's 113.93%, which is the same 756 on the hero it was drawn
   * on and keeps a taller one covered. `cover` is what takes up the
   * difference, by cropping the sides rather than stretching.
   */
  "media-arts-and-sciences": {
    image: mediaArtsAndSciencesBanner,
    left: "12.21%",
    top: "-13.96%",
    width: "100%",
    aspectRatio: "1440 / 650",
    minHeight: "113.93%",
    size: "cover",
    /* From the picture's own left edge, which is where the design starts it.
       Left to the default it would be pinned to the right instead, and what
       `cover` trimmed to fill a taller box would come off the front of the
       picture rather than the back. */
    position: "0% 50%",
  },
  /**
   * Urban Studies states a box again, and a third shape: 72.9% of the hero
   * wide and 122.68% of it tall, from 29.42% across and 25.63% above the top,
   * which is the 3:2 this photograph is.
   *
   * Its floor is the stated height rather than the hero's, because the design
   * does not take this one to the bottom: 122.68 less the 25.63 it is lifted
   * leaves the picture ending at 97.05%, and the wash is white down there in
   * any case.
   */
  "urban-studies-and-planning": {
    image: urbanStudiesAndPlanningBanner,
    left: "25.42%",
    top: "-25.63%",
    width: "75.9%",
    aspectRatio: "900 / 600",
    minHeight: "122.68%",
    size: "cover",
    position: "0% 50%",
  },
  /**
   * Aeronautics is drawn in a box 70.22% of the hero wide and lifted 5.47%
   * above it, at the 1.84 this photograph is. It starts further across than
   * the rest, and further left than the design's own 38.13%, which clipped an
   * eighth of the picture off the hero's right edge.
   *
   * Which is why it is also the one that states its own wash: the shared one
   * is angled for a picture beginning a third of the way across and reaches
   * white around 46% of the way over this building's top, where the design's
   * own angle leaves it near a quarter. The building is what the hero is for,
   * so the design's wash comes with the design's placement.
   *
   * The photograph is a cut-out -- the sky was transparent -- flattened onto
   * the white it is drawn against, which is what the hero is behind it.
   */
  "aeronautics-and-astronautics": {
    image: aeronauticsAndAstronauticsBanner,
    left: "30.13%",
    top: "-5.47%",
    width: "70.22%",
    aspectRatio: "1291 / 703",
    minHeight: "96.51%",
    size: "cover",
    position: "0% 50%",
    scrim:
      "linear-gradient(193.64deg, rgba(255, 255, 255, 0) 1.8914%, rgb(255, 255, 255) 50.795%)",
  },
  /**
   * Biological Engineering is the one the design does not lift at all -- the
   * top is a rounding error from zero, so the picture sits on the hero's own
   * top edge and runs off the bottom instead, at the 1.65 this photograph is.
   *
   * Its wash is the design's too, shallower again than Aeronautics' and
   * reaching white later, which is what keeps the building standing where
   * this one begins.
   */
  "biological-engineering": {
    image: biologicalEngineeringBanner,
    left: "41.51%",
    top: "0.02%",
    width: "60.02%",
    aspectRatio: "1840 / 1118",
    minHeight: "82.32%",
    size: "cover",
    position: "0% 50%",
    scrim:
      "linear-gradient(199.205deg, rgba(255, 255, 255, 0) 0%, rgb(255, 255, 255) 53.919%)",
  },
  /**
   * Chemical Engineering is drawn in the frame Architecture's numbers came
   * from -- the same box, the same lift, the shared wash -- and so would need
   * nothing stated here at all, but for the photograph.
   *
   * It is a 3:2, and that box is 4:3. The design resolves the two by pulling
   * the picture to fit, which leaves the building an eighth taller than it
   * stands; `100% 100%` is that, and is why this is the one entry that does
   * not keep its photograph's own shape.
   *
   * The alternative is `size: "cover"`, which holds the shape and takes the
   * difference off the sides instead -- at the cost of the framing, since it
   * crops in far enough to move the skyline across.
   */
  "chemical-engineering": {
    image: chemicalEngineeringBanner,
    left: "28.88%",
    top: "-28.85%",
    width: "71.1%",
    aspectRatio: "4 / 3",
    minHeight: "134.59%",
    size: "100% 100%",
  },
}

/**
 * The department hero, which draws the department's own artwork where there
 * is any and stands on plain white where there is not.
 *
 * Its own component to hold the hook: how the photograph is framed turns on
 * whether the channel features anything, which the shared hero cannot ask on
 * a department's behalf.
 */
const DepartmentChannelHero: React.FC<{
  channel: DepartmentChannel
  children: React.ReactNode
}> = ({ channel, children }) => {
  const banner = DEPARTMENT_BANNERS[channel.name]
  const featuredIsEmpty = useTopicFeaturedIsEmpty(
    ChannelTypeEnum.Department,
    channel.name,
  )

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
          <ChannelHeroPhoto
            configuredBanner={backgroundSrcSetCSS(banner.image)}
            featuredIsEmpty={featuredIsEmpty}
            placement={banner}
          />
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
export { DepartmentChannelTemplate, ChannelHeroPhoto, DEPARTMENT_BANNERS }
