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
 *
 * The `vw` term is the narrow screen's, which the design draws separately and
 * does not scale down from the wide one: there the photograph runs 340 of the
 * 375 the frame is wide, where scaling the wide design's band down by width
 * would leave it 90. A phone's hero is the taller of the two -- the same
 * title, description and Featured row over a quarter of the width -- so the
 * band that reads as a backdrop on a monitor reads as a stripe on a phone.
 *
 * 340/375 is 90.7vw, which gives the narrow design its depth, reaches the
 * wide design's 404 at 445px, and is held there by the `min` for every width
 * above that -- so both designs are drawn as drawn and the widths between
 * them move from one to the other.
 */
const HERO_FADE_END = "min(404px, 90.7vw, 100%)"

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
const HeroPhoto = styled.div<{ backgroundUrl: string; wholeWidth: boolean }>(
  ({ theme, backgroundUrl, wholeWidth }) => ({
    position: "absolute",
    top: 0,
    left: "22%",
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
    /**
     * With no Featured row, the design draws a different photograph: one
     * across the whole hero rather than a band three quarters of it wide, and
     * framed by width rather than cropped to fill.
     *
     * It states the image at the hero's own width and 509.15% of its height,
     * lifted 294.19% of that height above the top. The artwork is 1800x1203,
     * and 1676/1.4963 is exactly the 1120px that 509.15% of the design's 220px
     * hero comes to -- so the image is simply laid across the width at its own
     * proportions, and what the numbers describe is which slice of it that
     * leaves showing. Putting the lift over the overflow,
     * -294.19 / (1 - 509.15), gives the 71.9% below, and stating it that way
     * holds the same framing at every width rather than only at 1676.
     *
     * No mask: the band needed one because it had a left edge inside the hero
     * to soften, and a photograph across the whole width has none. The wash
     * is then the only thing taking it off, which is how the design builds it.
     *
     * Above `sm` only, so the narrow design -- drawn separately, and framed by
     * height rather than width -- keeps its own crop whether or not the
     * channel features anything.
     */
    ...(wholeWidth
      ? {
          [theme.breakpoints.up("sm")]: {
            left: 0,
            height: "100%",
            backgroundSize: "100% auto",
            backgroundPosition: "50% 71.903%",
            maskImage: "none",
            WebkitMaskImage: "none",
          },
        }
      : {}),
    /**
     * A phone's band is taller than it is wide, and `cover` fills whichever
     * axis needs the most magnifying -- so there it fills the height and fits
     * the photograph's full height into the band. That is the whole hall at a
     * quarter of the width: the banner, the columns and the walking figure all
     * shrink to nothing rather than the design's framing of them.
     *
     * Sizing by height instead keeps the subject at a legible scale. 147% of
     * the band is 480px at the 375 the design is drawn at, which is where the
     * banner and the walking figure land as drawn. Measured against the band
     * rather than the viewport so that the crop is the same picture at every
     * phone width, and so that a hero shortened by a missing Featured row
     * zooms out with it instead of filling with one magnified corner.
     */
    [theme.breakpoints.down("sm")]: {
      backgroundSize: "auto 147%",
      /* Short of the right edge, where the design's frame ends. */
      backgroundPosition: "87% bottom",
    },
  }),
)

/** Clears a column for the text beside the photograph. */
const HERO_SCRIM_FROM_LEFT =
  "linear-gradient(259.54deg, rgba(255, 255, 255, 0) 33.745%, rgb(255, 255, 255) 74.054%)"

/** Carries the photograph off above the rest of the page. */
const HERO_SCRIM_FROM_TOP = `linear-gradient(180deg, rgba(255, 255, 255, 0) calc(${HERO_FADE_END} * 0.0489), rgb(255, 255, 255) ${HERO_FADE_END})`

/**
 * The same two, as the design states them for the hero with no Featured row.
 *
 * Both are shares of that hero rather than distances, which is why they are
 * separate values: the wash from the top is not finished when the hero ends
 * -- white is 119.12% of the way down -- so the photograph is still faintly
 * there along the bottom edge, which is what the design draws and what
 * finishing the wash at the hero's own height washes away.
 *
 * The angles are the design's too. Figma states a gradient by where its
 * handles fall, so an angle belongs to the frame it was measured in: 255.69
 * is this hero's, where 259.54 above is the taller one's.
 */
const HERO_SCRIM_UNFEATURED_FROM_LEFT =
  "linear-gradient(255.69deg, rgba(255, 255, 255, 0) 33.745%, rgb(255, 255, 255) 74.054%)"
const HERO_SCRIM_UNFEATURED_FROM_TOP =
  "linear-gradient(179.22deg, rgba(255, 255, 255, 0) 12.703%, rgb(255, 255, 255) 119.12%)"

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
const HeroScrim = styled.div<{ unfeatured: boolean }>(
  ({ theme, unfeatured }) => ({
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    backgroundImage: [HERO_SCRIM_FROM_LEFT, HERO_SCRIM_FROM_TOP].join(", "),
    /* The hero with nothing to feature, which the design states on its own --
       see the values above. Above `sm`, with the photograph it belongs to. */
    ...(unfeatured
      ? {
          [theme.breakpoints.up("sm")]: {
            backgroundImage: [
              HERO_SCRIM_UNFEATURED_FROM_LEFT,
              HERO_SCRIM_UNFEATURED_FROM_TOP,
            ].join(", "),
          },
        }
      : {}),
    /**
     * Only the wash from the top on a narrow screen.
     *
     * The other one clears a column for text to sit *beside* the photograph,
     * and a phone has no beside: the text runs the full width, so that gradient
     * closes over the photograph behind the breadcrumb and the description and
     * leaves both on flat white. The design draws them with the photograph
     * showing through, which is what is left once this one goes -- the wash
     * from the top still carries it off before the rest of the page, and the
     * photograph's own left edge still fades under the start of each line.
     */
    [theme.breakpoints.down("sm")]: {
      backgroundImage: HERO_SCRIM_FROM_TOP,
    },
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
const TopicTitle = styled.h1(({ theme }) => ({
  ...theme.typography.h1,
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
 * machinery for one is still here for the department page, which is to have a
 * banner image of its own -- see `ChannelHeroPhoto`.
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
 * Nothing renders this yet. The topic page did until the design dropped the
 * photograph, and the department page is to have one, so it is kept whole
 * rather than rebuilt from scratch later -- and kept reachable, so it goes on
 * compiling and is not quietly broken by the time it is wanted.
 *
 * Takes the banner as configured on the channel and nothing else: the default
 * artwork that stood in for an unconfigured topic was the topic design's, and
 * a channel with no banner now draws none.
 */
const ChannelHeroPhoto: React.FC<{
  configuredBanner: string
  /** Frames the shorter hero a channel with nothing to feature leaves. */
  featuredIsEmpty: boolean
}> = ({ configuredBanner, featuredIsEmpty }) => (
  <>
    <HeroPhoto
      data-testid="channel-hero-photo"
      aria-hidden
      wholeWidth={featuredIsEmpty}
      /* Through the same standardizer the other channel banners use: the field
         holds either a bare src or a value already written as `url(...)`, and
         wrapping the second kind again drops the declaration. */
      backgroundUrl={standardizeBackgroundUrl(configuredBanner)}
    />
    <HeroScrim aria-hidden unfeatured={featuredIsEmpty} />
  </>
)

/**
 * The same page for an academic department.
 *
 * The design is the topic page's but for the hero's ground: a department has
 * no photograph behind its title, so the hero is the plain white the section
 * already paints and the words need no pane to be read against.
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
      <ChannelRedesignHero
        channel={channel.data}
        channelType={ChannelTypeEnum.Department}
      >
        {children}
      </ChannelRedesignHero>
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
                    <TopicTitle>{channel.title}</TopicTitle>
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
/* `ChannelHeroPhoto` is exported for the department banner it is being kept
   for, and so that nothing in it is dead to the compiler in the meantime. */
export { DepartmentChannelTemplate, ChannelHeroPhoto }
