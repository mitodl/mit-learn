import Link from "next/link"
import { Typography, styled, theme } from "ol-components"
import { ButtonLink } from "@mitodl/smoot-design"
import VideoContainer from "./VideoContainer"
export {
  SkipLinksNav,
  SkipLink,
  StyledBreadcrumbs,
  NoVideoMessage,
} from "./shared.styled"

export const PageWrapper = styled.div({
  backgroundColor: theme.custom.colors.lightGray1,
  minHeight: "100vh",
})

export const BreadcrumbBar = styled.div(({ theme }) => ({
  padding: "20px 0 4px 0",
  borderBottom: `2px solid ${theme.custom.colors.red}`,
  [theme.breakpoints.down("sm")]: {
    padding: "16px 0 0 0",
  },
}))

// ── Series navigation bar ──

export const SeriesNavBar = styled.div(({ theme }) => ({
  borderBottom: `1px solid ${theme.custom.colors.lightGray2}`,
}))

export const SeriesNavTopRow = styled(VideoContainer)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "56px 0 12px !important",
  gap: "16px",
  [theme.breakpoints.down("lg")]: {
    padding: "32px 16px 12px !important",
  },
}))

export const SeriesNavTitle = styled(Link)(({ theme }) => ({
  ...theme.typography.body3,
  color: theme.custom.colors.darkRed,
  fontWeight: theme.typography.fontWeightMedium,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  textDecoration: "none",
  flexShrink: 1,
  minWidth: 0,
  "&:hover": { color: theme.custom.colors.red, textDecoration: "underline" },
  [theme.breakpoints.down("sm")]: {
    ...theme.typography.body3,
    fontWeight: theme.typography.fontWeightMedium,
  },
}))

export const VideoPositionLabel = styled(Typography)(({ theme }) => ({
  ...theme.typography.body3,
  color: theme.custom.colors.darkGray2,
  whiteSpace: "nowrap",
  flexShrink: 0,
  [theme.breakpoints.down("sm")]: {
    ...theme.typography.body3,
    fontWeight: theme.typography.fontWeightMedium,
  },
}))

export const ProgressBarRow = styled(VideoContainer)(({ theme }) => ({
  display: "flex",
  gap: "3px",
  padding: "0 0 0 0 !important",
  [theme.breakpoints.down("lg")]: {
    padding: "0 16px !important",
  },
}))

export const ProgressSegment = styled.div<{ $active: boolean; $done: boolean }>(
  ({ theme, $active, $done }) => ({
    flex: 1,
    height: "4px",
    borderRadius: "2px",
    backgroundColor: $active
      ? theme.custom.colors.darkGray1
      : $done
        ? theme.custom.colors.darkRed
        : theme.custom.colors.lightGray2,
  }),
)

export const SeriesNavBottomRow = styled(VideoContainer)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "16px 0 16px !important",
  [theme.breakpoints.down("lg")]: {
    padding: "16px 16px 16px !important",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "16px",
  },
}))

export const NavLink = styled(Link)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: "6px",
  ...theme.typography.body3,
  color: theme.custom.colors.darkRed,
  textDecoration: "none",
  maxWidth: "45%",
  minWidth: 0,
  flexShrink: 1,
  "&:hover": { color: theme.custom.colors.red },
  [theme.breakpoints.down("sm")]: {
    maxWidth: "100%",
  },
}))

export const StyledButtonLink = styled(ButtonLink)(({ theme }) => ({
  marginTop: "8px",
  [theme.breakpoints.down("sm")]: {
    marginLeft: "24px",
    marginTop: "0",
  },
}))

export const NavLinkText = styled.span({
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  minWidth: 0,
  "&:hover": {
    textDecoration: "underline",
  },
})

export const NavArrowIcon = styled.span({
  flexShrink: 0,
  display: "flex",
  alignItems: "center",
})

export const ContentArea = styled.div(({ theme }) => ({
  padding: "40px 0 80px",
  [theme.breakpoints.down("sm")]: {
    padding: "32px 0 80px",
  },
}))

export const InstitutionLabel = styled.span(({ theme }) => ({
  display: "block",
  ...theme.typography.body2,
  fontWeight: theme.typography.fontWeightBold,
  color: theme.custom.colors.silverGrayDark,
  textTransform: "uppercase",
  marginBottom: "16px",
  lineHeight: "26px",
  [theme.breakpoints.down("sm")]: {
    ...theme.typography.body3,
    lineHeight: "22px",
    marginBottom: "8px",
  },
}))

export const VideoTitle = styled.h1(({ theme }) => ({
  ...theme.typography.h2,
  fontWeight: theme.typography.fontWeightBold,
  color: theme.custom.colors.black,
  margin: "0 0 16px",
  "&:focus": { outline: "none" },
  fontSize: "44px",
  fontStyle: "normal",
  lineHeight: "120%",
  letterSpacing: "-0.88px",
  [theme.breakpoints.down("sm")]: {
    ...theme.typography.h3,
    margin: "0 0 8px",
    letterSpacing: "inherit",
  },
}))

export const PlayerWrapper = styled.div(({ theme }) => ({
  width: "100%",
  aspectRatio: "16/9",
  backgroundColor: "#000",
  overflow: "hidden",
  position: "relative",
  borderBottom: `3px solid ${theme.custom.colors.darkGray2}`,
  [theme.breakpoints.down("sm")]: {
    marginTop: "0",
  },
  ".video-js, .vjs-tech": {
    width: "100% !important",
    height: "100% !important",
    position: "absolute",
    top: 0,
    left: 0,
  },
  ".vjs-big-play-button": {
    width: "92px !important",
    height: "92px !important",
    lineHeight: "92px !important",
    borderRadius: "50% !important",
    backgroundColor: "#d8daddb3 !important",
    border: "none !important",
    fontSize: "4em !important",
    marginTop: "-1.25em !important",
    marginLeft: "-1.18em !important",
    [theme.breakpoints.down("sm")]: {
      width: "68px !important",
      height: "68px !important",
      lineHeight: "68px !important",
      marginLeft: "-1em !important",
      marginTop: "-.7em !important",
    },
  },

  ".vjs-icon-placeholder": {
    border: "none !important",
  },

  "& .vjs-big-play-button": {
    opacity: 1,
    transform: "scale(1)",
    transition: "opacity 0.3s ease, transform 0.3s ease",
  },
  "&:hover .vjs-big-play-button": {
    opacity: 0.75,
    transform: "scale(1.12)",
  },
}))

// ── UP NEXT section ──

export const UpNextSection = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "16px",
  padding: "16px 32px",
  marginBottom: "32px",
  [theme.breakpoints.down("sm")]: {
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "12px",
    padding: "16px 0",
  },
}))

export const UpNextLeft = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  minWidth: 0,
  [theme.breakpoints.down("sm")]: {
    paddingLeft: "24px",
  },
}))

export const UpNextLabel = styled(Typography)(({ theme }) => ({
  ...theme.typography.body1,
  fontWeight: theme.typography.fontWeightBold,
  color: theme.custom.colors.silverGrayDark,
  textTransform: "uppercase",
  lineHeight: "150%",
  [theme.breakpoints.down("sm")]: {
    ...theme.typography.body2,
    lineHeight: "22px",
  },
}))

export const UpNextTitle = styled(Typography)(({ theme }) => ({
  ...theme.typography.body1,
  fontWeight: theme.typography.fontWeightMedium,
  color: theme.custom.colors.darkGray2,
  lineHeight: "24px",
  overflow: "hidden",
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
}))

export const MetaRow = styled.div(({ theme }) => ({
  ...theme.typography.body2,
  color: theme.custom.colors.darkGray1,
  marginBottom: "40px",
  lineHeight: "1.8",
  [theme.breakpoints.down("sm")]: {
    marginBottom: "32px",
  },
}))

export const MetaInstructorLine = styled.div(({ theme }) => ({
  fontWeight: theme.typography.fontWeightBold,
  color: theme.custom.colors.darkGray2,
}))

export const StyledDuration = styled.div(({ theme }) => ({
  ...theme.typography.body2,
  color: theme.custom.colors.silverGrayDark,
  margin: "0 0 40px",
  [theme.breakpoints.down("sm")]: {
    margin: "0 0 16px",
  },
}))

export const DescriptionText = styled(Typography)(({ theme }) => ({
  ...theme.typography.body2,
  color: theme.custom.colors.darkGray2,
  marginBottom: "16px",
  lineHeight: "22px",
  [theme.breakpoints.down("sm")]: {
    ...theme.typography.body2,
    lineHeight: "22px",
    marginBottom: "24px",
  },
}))

export const SectionDivider = styled.div(({ theme }) => ({
  borderTop: `1px solid ${theme.custom.colors.lightGray2}`,
  margin: "32px 0",
}))

// ── VIDEO SERIES section (topic chips) ──

export const VideoSeriesSectionHeading = styled(Typography)(({ theme }) => ({
  ...theme.typography.body3,
  fontWeight: theme.typography.fontWeightBold,
  color: theme.custom.colors.black,
  textTransform: "uppercase",
  letterSpacing: "1.92px",
  marginBottom: "16px",
}))

export const TopicChipsRow = styled.div({
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
})

export const TopicChip = styled(Link)(({ theme }) => ({
  display: "inline-flex",
  alignItems: "center",
  padding: "8px 16px",
  border: `1px solid ${theme.custom.colors.silverGrayLight}`,
  color: theme.custom.colors.darkRed,
  textDecoration: "none",
  ...theme.typography.body3,
  lineHeight: "12px",
  fontWeight: theme.typography.fontWeightMedium,
  "&:hover": {
    backgroundColor: theme.custom.colors.silverGrayLight,
    color: theme.custom.colors.red,
  },
}))

export const ThumbnailWrapper = styled.div({
  position: "relative",
  width: "100%",
  height: "100%",
})

export const ScreenReaderOnly = styled.span({
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
})
