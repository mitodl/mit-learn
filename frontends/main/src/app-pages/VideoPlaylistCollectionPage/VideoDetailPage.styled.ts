import Link from "next/link"
import { Typography, styled, theme } from "ol-components"
import VideoResourcePlayer from "@/page-components/VideoPlayer/VideoResourcePlayer"

// Primitives shared with the other video pages, re-exported so consumers of this
// module have a single import for the page's styles.
export {
  SkipLinksNav,
  StyledBreadcrumbs,
  DurationBadge,
  PlayOverlay,
  PlayIcon,
  ThumbnailWrapper,
  VideoTitle,
} from "./shared.styled"
export { ScreenReaderOnly } from "@/page-components/VideoPlayer/shared.styled"

// ── Page shell ──

export const PageWrapper = styled.div({
  backgroundColor: "#fff",
  minHeight: "100vh",
})

export const BreadcrumbBar = styled.div(({ theme }) => ({
  padding: "18px 0 2px 0",
  borderBottom: `1px solid ${theme.custom.colors.red}`,
  [theme.breakpoints.down("sm")]: {
    padding: "12px 0 0 0",
  },
}))

export const ContentArea = styled.div(({ theme }) => ({
  padding: "56px 0 80px",
  [theme.breakpoints.down("sm")]: {
    padding: "32px 0 80px",
  },
}))

export const CategoryLabel = styled(Link)(({ theme }) => ({
  display: "block",
  ...theme.typography.body3,
  fontWeight: theme.typography.fontWeightBold,
  color: theme.custom.colors.red,
  textTransform: "uppercase",
  letterSpacing: "1.92px",
  marginBottom: "8px",
  fontSize: "12px",
  fontStyle: "normal",
  lineHeight: "150%" /* 18px */,
  "&:hover": {
    textDecoration: "underline",
  },
}))

// ── Title / meta row ──

export const VideoShareSection = styled("div")({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: "8px",
  marginBottom: "24px",
  [theme.breakpoints.down("sm")]: {
    marginBottom: "16px",
  },
})

export const MetaRow = styled.div({
  ...theme.typography.body2,
  color: theme.custom.colors.darkGray1,
})

export const TopicText = styled.span(({ theme }) => ({
  color: theme.custom.colors.silverGrayDark,
  ...theme.typography.body2,
  lineHeight: "22px",
  paddingLeft: "8px",
}))

export const DurationText = styled.span(({ theme }) => ({
  color: theme.custom.colors.black,
  ...theme.typography.body2,
  lineHeight: "22px",
  fontWeight: theme.typography.fontWeightBold,
}))

// ── Player / description ──

export const StyledVideoResourcePlayer = styled(VideoResourcePlayer)(
  ({ theme }) => ({
    [theme.breakpoints.down("sm")]: {
      marginTop: "0",
    },
  }),
)

export const BorderLine = styled.div(({ theme }) => ({
  borderBottom: `4px solid ${theme.custom.colors.darkGray2}`,
  marginBottom: "40px",
  [theme.breakpoints.down("sm")]: {
    marginBottom: "24px",
  },
}))

export const DescriptionText = styled(Typography)(({ theme }) => ({
  ...theme.typography.body1,
  color: theme.custom.colors.darkGray2,
  marginBottom: "22px",
  fontSize: "18px",
  fontWeight: theme.typography.fontWeightMedium,
  lineHeight: "30px",
  [theme.breakpoints.down("sm")]: {
    fontSize: "16px",
    lineHeight: "28px",
    marginBottom: "24px",
  },
}))

// ── "More from playlist" list ──

export const MoreFromTitle = styled(Typography)(({ theme }) => ({
  ...theme.typography.body3,
  fontWeight: theme.typography.fontWeightBold,
  textTransform: "uppercase",
  color: theme.custom.colors.black,
  padding: "32px 0",
  lineHeight: "150%",
  letterSpacing: "1.92px",
  [theme.breakpoints.down("sm")]: {
    padding: "24px 0",
  },
}))

export const MoreFromList = styled.div({
  display: "flex",
  flexDirection: "column",
})

export const MoreFromItem = styled(Link)({
  display: "flex",
  alignItems: "flex-start",
  gap: "24px",
  padding: "24px 0",
  borderBottom: `1px solid ${theme.custom.colors.lightGray2}`,
  textDecoration: "none",
  "&:hover .mf-title": { color: theme.custom.colors.red },

  "&:hover .video-card-title, &:focus-visible .video-card-title": {
    color: theme.custom.colors.red,
  },

  "&:hover .play-overlay": {
    opacity: 0.5,
  },

  "&:focus-visible .play-overlay": {
    opacity: 0.5,
  },

  "&:first-child": {
    padding: "0 0 24px 0",
  },

  [theme.breakpoints.down("sm")]: {
    flexDirection: "column",
  },
})

export const MoreFromTextSide = styled.div(({ theme }) => ({
  flex: 1,
  minWidth: 0,
  paddingTop: "17px",
  [theme.breakpoints.down("sm")]: {
    paddingTop: 0,
  },
}))

export const MoreFromItemTitle = styled(Typography)({
  ...theme.typography.subtitle2,
  fontWeight: theme.typography.fontWeightBold,
  color: theme.custom.colors.black,
  transition: "color 0.15s",
  marginBottom: "4px",
  fontSize: "20px",
  lineHeight: "26px" /* 130% */,
})

export const MoreFromItemMeta = styled(Typography)({
  ...theme.typography.body2,
  color: theme.custom.colors.silverGrayDark,
  overflow: "hidden",
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  lineHeight: "22px",
})

export const SeeAllLink = styled(Link)(({ theme }) => ({
  display: "inline-flex",
  alignItems: "center",
  marginTop: "40px",
  ...theme.typography.body1,
  color: theme.custom.colors.red,
  fontWeight: theme.typography.fontWeightMedium,
  lineHeight: "150%",
  textDecoration: "none",
  "&:hover": { textDecoration: "underline" },
  [theme.breakpoints.down("sm")]: {
    marginTop: "28px",
  },
}))

/** Mobile-only gap between "More from" rows; collapses to nothing on desktop. */
export const SpacerBlock = styled.div(({ theme }) => ({
  "& .spacer-block": {
    display: "none",
  },
  [theme.breakpoints.down("sm")]: {
    height: "8px",
    "& .spacer-block": {
      display: "block",
    },
  },
}))

/** Row placeholder matching a "More from" item while the playlist loads. */
export const MoreFromSkeletonRow = styled.div(({ theme }) => ({
  display: "flex",
  gap: 16,
  padding: "16px 0",
  borderBottom: `1px solid ${theme.custom.colors.lightGray2}`,
}))
