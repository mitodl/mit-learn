import React from "react"
import { Link, Popover, Stack, styled, Typography } from "ol-components"
import NextLink from "next/link"
import { EnrollmentStatus } from "./helpers"
import { ActionButton, Button, ButtonLink } from "@mitodl/smoot-design"
import { formatDate, getTimezone, isInPast } from "ol-utilities"
import { getCourseDateText, getRelativeDateContent } from "./courseDateUtils"
import { RiAwardLine } from "@remixicon/react"

const CardRoot = styled.div<{
  screenSize: "desktop" | "mobile"
  layout?: "default" | "compact"
}>(({ theme, screenSize, layout = "default" }) => [
  {
    position: "relative",
    border: `1px solid ${theme.custom.colors.lightGray2}`,
    backgroundColor: theme.custom.colors.white,
    padding: "16px",
    borderRadius: "8px",
    boxShadow: "0 4px 8px 0 rgba(19, 20, 21, 0.08)",
    display: "flex",
    gap: "8px",
    alignItems: "center",
  },
  // Mobile styles for default layout
  layout === "default" && {
    [theme.breakpoints.down("sm")]: {
      border: "none",
      flexDirection: "column",
      gap: "16px",
    },
  },
  // Compact layout styles
  layout === "compact" && {
    border: "none",
    borderBottom: `1px solid ${theme.custom.colors.lightGray2}`,
    borderRadius: "0px !important",
    boxShadow: "none",
    "&:first-of-type": {
      borderTopLeftRadius: "8px !important",
      borderTopRightRadius: "8px !important",
    },
    "&:last-of-type": {
      borderBottomLeftRadius: "8px !important",
      borderBottomRightRadius: "8px !important",
      borderBottom: "none",
    },
    [theme.breakpoints.down("sm")]: {
      flexDirection: "column",
      flexGrow: 1,
      gap: "16px",
    },
  },
  screenSize === "desktop" && {
    [theme.breakpoints.down("sm")]: {
      display: "none",
    },
  },
  screenSize === "mobile" && {
    [theme.breakpoints.up("sm")]: {
      display: "none",
    },
  },
])

const CardTypeText = styled(Typography)(({ theme }) => ({
  ...theme.typography.body3,
  color: theme.custom.colors.silverGrayDark,
}))

const TitleHeading = styled.h3(({ theme }) => ({
  margin: 0,
  ...theme.typography.subtitle1,
  [theme.breakpoints.down("sm")]: {
    maxWidth: "calc(100% - 16px)",
  },
}))

const TitleLink = styled(Link)(({ theme }) => ({
  ...theme.typography.subtitle1,
}))

const TitleText = styled.h3<{ clickable?: boolean }>(
  ({ theme, clickable }) => ({
    margin: 0,
    ...theme.typography.subtitle1,
    color: theme.custom.colors.darkGray2,
    cursor: clickable ? "pointer" : "default",
    [theme.breakpoints.down("sm")]: {
      maxWidth: "calc(100% - 16px)",
    },
  }),
)

const SubtitleLinkRoot = styled.div(({ theme }) => ({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  rowGap: "2px",
  flex: 1,
  minWidth: 0,
  color: theme.custom.colors.red,
  ...theme.typography.body3,
}))

const SubtitleLink = styled(NextLink)(({ theme }) => ({
  ...theme.typography.body3,
  color: theme.custom.colors.red,
  display: "flex",
  alignItems: "center",
  gap: "2px",
  ":hover": {
    textDecoration: "underline",
  },
}))

const MenuButton = styled(ActionButton)<{
  status: EnrollmentStatus
}>(({ theme, status }) => [
  {
    [theme.breakpoints.down("sm")]: {
      borderRadius: "4px",
      border: `1px solid ${theme.custom.colors.lightGray2}`,
    },
  },
  status !== EnrollmentStatus.Completed &&
    status !== EnrollmentStatus.Enrolled && {
      visibility: "hidden",
    },
])

const COURSEWARE_BUTTON_WIDTH = "80px"

// Fixed-width column that keeps the courseware button (and countdown) aligned
// in the compact (module row) layout.
const CoursewareActionColumn = styled(Stack)({
  minWidth: COURSEWARE_BUTTON_WIDTH,
  gap: "8px",
  flexShrink: 0,
})

// Compact-layout courseware buttons are fixed width and use the text variant.
const CoursewareButton = styled(Button)(({ theme, variant }) => ({
  minWidth: COURSEWARE_BUTTON_WIDTH,
  gap: "8px",
  ...(variant === "text" && {
    color: theme.custom.colors.silverGrayDark,
  }),
  [theme.breakpoints.down("sm")]: {
    flexGrow: 1,
  },
}))

const CoursewareButtonLink = styled(ButtonLink)(({ theme, variant }) => ({
  width: COURSEWARE_BUTTON_WIDTH,
  minWidth: COURSEWARE_BUTTON_WIDTH,
  ...(variant === "text" && {
    color: theme.custom.colors.silverGrayDark,
  }),
  [theme.breakpoints.down("sm")]: {
    flexGrow: 1,
  },
}))

const Separator = styled.span(({ theme }) => ({
  display: "inline-block",
  width: "1px",
  height: "12px",
  margin: "0 8px",
  backgroundColor: theme.custom.colors.silverGrayLight,
}))

const Ellipse = styled.span(({ theme }) => ({
  display: "inline-block",
  width: "4px",
  height: "4px",
  borderRadius: "50%",
  flexShrink: 0,
  backgroundColor: theme.custom.colors.silverGrayLight,
}))

const DateText = styled(Typography)(({ theme }) => ({
  ...theme.typography.subtitle3,
  color: theme.custom.colors.silverGrayDark,
  whiteSpace: "nowrap",
}))

const CourseDateText: React.FC<{
  startDate?: string | null | undefined
  endDate?: string | null | undefined
  className?: string
}> = ({ startDate, endDate, className }) => {
  const text = getCourseDateText(startDate, endDate)
  if (!text) return null
  return <DateText className={className}>{text}</DateText>
}

const UpgradedBannerRoot = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: "4px",
  color: theme.custom.colors.silverGrayDark,
  whiteSpace: "nowrap",
  ...theme.typography.body3,
}))

const UpgradedBanner: React.FC<{ className?: string }> = ({ className }) => (
  <UpgradedBannerRoot data-testid="upgraded-banner" className={className}>
    <RiAwardLine size="16px" />
    Certificate track
  </UpgradedBannerRoot>
)

const DatePopoverContent = styled.div({
  maxWidth: "240px",
  display: "flex",
  padding: "8px",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "28px",
  alignSelf: "stretch",
})

const DatePopoverTrigger = styled("button")<{ $upcoming: boolean }>(
  ({ theme, $upcoming }) => ({
    ...theme.typography.subtitle3,
    color: $upcoming
      ? theme.custom.colors.red
      : theme.custom.colors.silverGrayDark,
    background: "none",
    border: "none",
    padding: 0,
    cursor: "pointer",
    "&:hover": {
      color: $upcoming ? theme.custom.colors.red : theme.custom.colors.black,
      textDecoration: "underline",
    },
  }),
)

const DatePopoverHeading = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.black,
}))

const DatePopoverBody = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.black,
}))

const DatePopoverDismissButton = styled(Button)({
  alignSelf: "flex-end",
})

const CourseDateSummary: React.FC<{
  startDate?: string | null | undefined
  endDate?: string | null | undefined
}> = ({ startDate, endDate }) => {
  const popoverId = React.useId()
  const [popoverAnchorEl, setPopoverAnchorEl] =
    React.useState<HTMLButtonElement | null>(null)

  const triggerText = getCourseDateText(startDate, endDate)
  const isUpcoming = startDate ? isInPast(startDate) === false : false
  const startDateFormatted = startDate
    ? `${formatDate(startDate, "MMMM D, YYYY h:mm A")} ${getTimezone(startDate)}`
    : null
  const endDateFormatted = endDate
    ? `${formatDate(endDate, "MMMM D, YYYY h:mm A")} ${getTimezone(endDate)}`
    : null
  const datePopoverContent = getRelativeDateContent(
    startDate,
    endDate,
    startDateFormatted,
    endDateFormatted,
  )

  if (!triggerText || !datePopoverContent) return null

  return (
    <>
      <Popover
        anchorEl={popoverAnchorEl}
        open={!!popoverAnchorEl}
        onClose={() => setPopoverAnchorEl(null)}
      >
        <DatePopoverContent
          id={popoverId}
          role="dialog"
          aria-label="Important Dates"
        >
          <Stack direction="column" gap="4px">
            <DatePopoverHeading variant="subtitle3">
              Important Dates:
            </DatePopoverHeading>
            <DatePopoverBody variant="body3">
              This course{" "}
              <Typography variant="subtitle3" component="span">
                {datePopoverContent.startVerb}
              </Typography>{" "}
              {datePopoverContent.startSuffix}
            </DatePopoverBody>
          </Stack>
          {datePopoverContent.endVerb && datePopoverContent.endSuffix && (
            <DatePopoverBody variant="body3">
              This course{" "}
              <Typography variant="subtitle3" component="span">
                {datePopoverContent.endVerb}
              </Typography>{" "}
              {datePopoverContent.endSuffix}
            </DatePopoverBody>
          )}
          <DatePopoverDismissButton
            variant="primary"
            size="small"
            onClick={() => setPopoverAnchorEl(null)}
          >
            Got it!
          </DatePopoverDismissButton>
        </DatePopoverContent>
      </Popover>
      <DatePopoverTrigger
        $upcoming={isUpcoming}
        aria-expanded={!!popoverAnchorEl}
        aria-haspopup="dialog"
        aria-controls={popoverAnchorEl ? popoverId : undefined}
        onClick={(event) => setPopoverAnchorEl(event.currentTarget)}
      >
        {triggerText}
      </DatePopoverTrigger>
    </>
  )
}

export {
  CardRoot,
  CardTypeText,
  TitleHeading,
  TitleLink,
  TitleText,
  SubtitleLinkRoot,
  SubtitleLink,
  MenuButton,
  CoursewareActionColumn,
  CoursewareButton,
  CoursewareButtonLink,
  Separator,
  Ellipse,
  DateText,
  CourseDateText,
  CourseDateSummary,
  UpgradedBanner,
}
