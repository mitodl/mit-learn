import { styled, Typography, LoadingSpinner } from "ol-components"

/**
 * Styled primitives shared by the two podcast players (the fixed player bar and
 * the embed card). Layout-specific chrome (the outer shells, cover art, divider,
 * close button) stays in each component; each may extend these bases via
 * `styled(...)` for size/grid tweaks.
 */

export const TrackInfo = styled.div({
  display: "flex",
  flexDirection: "column",
  minWidth: 0,
})

export const TrackTitle = styled(Typography)(({ theme }) => ({
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  color: theme.custom.colors.black,
}))

export const PodcastName = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.silverGrayDark,
}))

export const Controls = styled.div({
  gridArea: "controls",
  display: "flex",
  alignItems: "center",
  gap: "12px",
})

export const IconButton = styled.button(({ theme }) => ({
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: 0,
  display: "flex",
  alignItems: "center",
  color: theme.custom.colors.silverGray,
  "&:hover": { color: theme.custom.colors.red },
  "& svg": { width: "24px", height: "24px" },
}))

export const PlayPauseButton = styled("button", {
  shouldForwardProp: (prop) =>
    prop !== "buttonSize" && prop !== "mobileButtonSize",
})<{ buttonSize?: number; mobileButtonSize?: number }>(
  ({ theme, buttonSize = 48, mobileButtonSize }) => ({
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: 0,
    // Fixed size + overflow:hidden keeps the spinner clipped inside the button.
    // The spinner is absolutely centered; play/pause icons fill the same area.
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: `${buttonSize}px`,
    height: `${buttonSize}px`,
    flexShrink: 0,
    overflow: "hidden",
    color: theme.custom.colors.red,
    "&:hover": { opacity: 0.8 },
    // Target only direct SVG children (Remix icons) — not the spinner's SVG.
    "& > svg": { width: `${buttonSize}px`, height: `${buttonSize}px` },
    ...(mobileButtonSize && {
      [theme.breakpoints.down("sm")]: {
        width: `${mobileButtonSize}px`,
        height: `${mobileButtonSize}px`,
        "& > svg": {
          width: `${mobileButtonSize}px`,
          height: `${mobileButtonSize}px`,
        },
      },
    }),
  }),
)

export const PlayerLoader = styled(LoadingSpinner)({
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
})

export const ProgressWrapper = styled.div({
  gridArea: "progress",
  display: "flex",
  alignItems: "center",
})

export const ProgressRange = styled("input", {
  shouldForwardProp: (prop) =>
    prop !== "percent" && prop !== "trackHeight" && prop !== "thumbSize",
})<{ percent: number; trackHeight?: number; thumbSize?: number }>(
  ({ theme, percent, trackHeight = 12, thumbSize = 14 }) => ({
    appearance: "none",
    WebkitAppearance: "none",
    flex: 1,
    height: `${trackHeight}px`,
    borderRadius: `${trackHeight / 2}px`,
    cursor: "pointer",
    outline: "none",
    border: "none",
    padding: 0,
    background: `linear-gradient(to right, ${theme.custom.colors.red} ${percent}%, ${theme.custom.colors.lightGray2} ${percent}%)`,
    "&::-webkit-slider-thumb": {
      WebkitAppearance: "none",
      width: `${thumbSize}px`,
      height: `${thumbSize}px`,
      borderRadius: "50%",
      background: theme.custom.colors.red,
      cursor: "pointer",
    },
    "&::-moz-range-thumb": {
      width: `${thumbSize}px`,
      height: `${thumbSize}px`,
      borderRadius: "50%",
      background: theme.custom.colors.red,
      border: "none",
      cursor: "pointer",
    },
  }),
)

export const TimeLabel = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.darkGray2,
  whiteSpace: "nowrap",
  flexShrink: 0,
  minWidth: "38px",
  textAlign: "center",
}))

export const SpeedButton = styled.button(({ theme }) => ({
  border: `1px solid ${theme.custom.colors.silverGrayLight}`,
  backgroundColor: theme.custom.colors.lightGray1,
  borderRadius: "4px",
  padding: "4px 12px",
  cursor: "pointer",
  ...theme.typography.body3,
  color: theme.custom.colors.darkGray2,
  flexShrink: 0,
  "&:hover": {
    borderColor: theme.custom.colors.red,
    color: theme.custom.colors.red,
  },
}))
