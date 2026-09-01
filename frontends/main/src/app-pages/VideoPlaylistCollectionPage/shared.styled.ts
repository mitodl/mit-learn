import {
  styled,
  Breadcrumbs,
  HEADER_HEIGHT,
  HEADER_HEIGHT_MD,
} from "ol-components"
import { RiPlayCircleFill } from "@remixicon/react"

export const SkipLinksNav = styled.nav(({ theme }) => ({
  position: "absolute",
  // Reveal skip links just below the fixed site header rather than over it, so
  // they don't overlap the logo/nav. Kept above the header's z-index too, as a
  // safeguard against any boundary overlap.
  top: HEADER_HEIGHT,
  left: 0,
  zIndex: theme.zIndex.appBar + 1,
  [theme.breakpoints.down("md")]: {
    top: HEADER_HEIGHT_MD,
  },
}))

export const StyledBreadcrumbs = styled(Breadcrumbs)(() => ({
  "& > span > span": { paddingBottom: 0, paddingLeft: "4px" },
}))

/**
 * Duration (or "N videos • time") badge pinned to a thumbnail's bottom-right.
 *
 * `$dense` tightens the padding for the smaller thumbnails in the video detail
 * page's "More from" list; everywhere else uses the roomier default.
 */
export const DurationBadge = styled.span<{ $dense?: boolean }>(
  ({ theme, $dense }) => ({
    ...theme.typography.body3,
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: theme.custom.colors.darkGray2,
    color: "#fff",
    fontWeight: theme.typography.fontWeightMedium,
    padding: $dense ? "4px 6px" : "8px",
    zIndex: 1,
  }),
)

/**
 * Fixed-width 16:9 thumbnail frame, full-width on mobile. Positioning context
 * for `DurationBadge` and `PlayOverlay`.
 */
export const ThumbnailWrapper = styled.div(({ theme }) => ({
  position: "relative",
  flexShrink: 0,
  width: 160,
  aspectRatio: "16/9",
  overflow: "hidden",
  backgroundColor: theme.custom.colors.black,
  [theme.breakpoints.down("sm")]: {
    width: "100%",
  },
}))

/**
 * Dim scrim with a centred play icon, revealed on hover/focus of the enclosing
 * card link (which owns the `.play-overlay` opacity rules).
 *
 * NB: `FeaturedVideo` keeps its own overlay rather than sharing this one — it is
 * a different treatment (always visible, scales on hover, no scrim), and only
 * coincidentally has the same name.
 */
export const PlayOverlay = styled.div({
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#fff",
  opacity: 0,
  transition: "opacity 0.2s",
  backgroundColor: "rgba(0, 0, 0, 0.18)",
})

/** The play glyph shown inside `PlayOverlay`. */
export const PlayIcon = styled(RiPlayCircleFill)({
  width: 36,
  height: 36,
})

/**
 * `<h1>` for a video page. Focusable (without a focus ring) so the page can move
 * focus here once loading finishes.
 *
 * `$compact` trims the bottom margin for the series page, which already has the
 * series nav bar directly above the title.
 */
export const VideoTitle = styled.h1<{ $compact?: boolean }>(
  ({ theme, $compact }) => ({
    ...theme.typography.h2,
    fontWeight: theme.typography.fontWeightBold,
    color: theme.custom.colors.black,
    margin: $compact ? "0 0 16px" : "0 0 24px",
    "&:focus": { outline: "none" },
    fontSize: "44px",
    fontStyle: "normal",
    lineHeight: "120%",
    letterSpacing: "-0.88px",
    [theme.breakpoints.down("sm")]: {
      ...theme.typography.h3,
      margin: $compact ? "0 0 8px" : "0 0 14px",
      letterSpacing: "inherit",
    },
  }),
)
