import React, { useState } from "react"
import { ActionButton, styled, Button } from "@mitodl/smoot-design"
import { Dialog, Link, Typography, Stack } from "ol-components"
import type { StackProps } from "ol-components"
import { RiInformation2Line } from "@remixicon/react"
import type { CourseRunV2 } from "@mitodl/mitxonline-api-axios/v2"

const ResponsiveLink = styled(Link)(({ theme }) => ({
  ...theme.typography.body2, // override default for "black" color is subtitle2
  [theme.breakpoints.down("sm")]: {
    ...theme.typography.body3,
  },
}))

const UnderlinedLink = styled(ResponsiveLink)({
  textDecoration: "underline",
})

const InfoRow = styled.div(({ theme }) => ({
  width: "100%",
  display: "flex",
  gap: "8px",
  alignItems: "flex-start",
  color: theme.custom.colors.darkGray2,
  ...theme.typography.body2,
  [theme.breakpoints.down("sm")]: {
    ...theme.typography.body3,
  },
}))

/**
 * Centers an icon within a flex row. Uses height matching the text line-height
 * so that flex-start alignment on the parent keeps it pinned to the first line.
 */
const InfoRowIcon = styled.span(({ theme }) => ({
  display: "inline-flex",
  alignItems: "center",
  height: theme.typography.body2.lineHeight,
  [theme.breakpoints.down("sm")]: {
    height: theme.typography.body3.lineHeight,
  },
  flexShrink: 0,
  "> svg": {
    width: "20px",
    height: "20px",
  },
}))

const InfoRowInner: React.FC<Pick<StackProps, "children" | "flexWrap">> = (
  props,
) => (
  <Stack
    width="100%"
    direction="row"
    gap="12px"
    justifyContent="space-between"
    flexWrap="wrap"
    {...props}
  />
)

type InfoLabelProps = {
  underline?: boolean
  variant?: "light" | "normal"
}

const InfoLabel = styled.span<InfoLabelProps>(
  ({ theme, underline, variant = "normal" }) => [
    variant === "normal" && {
      fontWeight: theme.typography.fontWeightBold,
    },
    variant === "light" && {
      color: theme.custom.colors.silverGrayDark,
    },
    underline && { textDecoration: "underline" },
  ],
)

const InfoLabelValue: React.FC<{
  label: React.ReactNode
  value: React.ReactNode
  labelVariant?: "light" | "normal"
}> = ({ label, value, labelVariant }) =>
  value ? (
    <span>
      <InfoLabel variant={labelVariant}>{label}</InfoLabel>
      {": "}
      {value}
    </span>
  ) : null

/**
 * Centers an icon button inline within flowing text. Uses verticalAlign to
 * align itself on the line box (works because inline-flex is inline-level).
 */
const ButtonContainer = styled.span(({ theme }) => ({
  marginLeft: "8px",
  // center container within text
  display: "inline-flex",
  verticalAlign: "middle",
  height: theme.typography.body2.lineHeight,
  [theme.breakpoints.down("sm")]: {
    height: theme.typography.body3.lineHeight,
  },
  // center icon in container
  alignItems: "center",
  "> button": {
    color: theme.custom.colors.silverGrayDark,
  },
}))

const CertificateBoxRoot = styled.div(({ theme }) => ({
  width: "100%",
  backgroundColor: theme.custom.colors.lightGray1,
  borderRadius: "8px",
  padding: "16px",
  display: "flex",
  flexDirection: "column",
  gap: "8px",
}))

const GrayText = styled.span(({ theme }) => ({
  color: theme.custom.colors.silverGrayDark,
}))

const StrickenText = styled.span(({ theme }) => ({
  textDecoration: "line-through",
  color: theme.custom.colors.silverGrayDark,
  ...theme.typography.body3,
  [theme.breakpoints.down("sm")]: {
    ...theme.typography.body4,
  },
}))

/**
 * Flex column by default; on tablet switches to CSS multi-column so
 * metadata rows flow top-to-bottom then wrap to the next column.
 */
const SummaryRows = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: "24px",
  [theme.breakpoints.up("md")]: {
    gap: "32px",
  },
  [theme.breakpoints.between("sm", "md")]: {
    display: "block",
    columnCount: 2,
    columnGap: "48px",
    columnRule: `1px solid ${theme.custom.colors.lightGray2}`,
    "> *": {
      breakInside: "avoid",
      marginBottom: "24px",
      "&:last-child": {
        marginBottom: 0,
      },
    },
  },
}))

type LearnMoreDialogProps = {
  buttonText?: string
  href: string
  description: string
  title: string
  iconOnly?: boolean
}

const LearnMoreDialog: React.FC<LearnMoreDialogProps> = ({
  buttonText,
  href,
  description,
  title,
  iconOnly = false,
}) => {
  const [open, setOpen] = useState(false)
  return (
    <>
      {iconOnly ? (
        <ButtonContainer>
          <ActionButton
            size="small"
            onClick={() => setOpen(true)}
            aria-label={title}
            variant="text"
          >
            <RiInformation2Line aria-hidden="true" />
          </ActionButton>
        </ButtonContainer>
      ) : (
        <UnderlinedLink
          target="_blank"
          rel="noopener noreferrer"
          color="black"
          href=""
          role="button"
          onClick={(event) => {
            event.preventDefault()
            setOpen(true)
          }}
        >
          {buttonText}
        </UnderlinedLink>
      )}
      <Dialog
        onClose={() => setOpen(false)}
        open={open}
        title={title}
        actions={null}
      >
        <Typography sx={{ marginBottom: "16px" }}>{description}</Typography>
        <UnderlinedLink
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          color="black"
        >
          Learn More
        </UnderlinedLink>
      </Dialog>
    </>
  )
}

/**
 * Outer card wrapper: border, shadow, radius. No padding — children control
 * their own insets so that elements like the bundle upsell can span edge-to-edge.
 */
const SummaryCard = styled.div(({ theme }) => ({
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  backgroundColor: theme.custom.colors.white,
  borderRadius: "4px",
  boxShadow: "0 8px 20px 0 rgba(120, 147, 172, 0.10)",
  overflow: "hidden",
}))

/** Padded content area inside the summary card. */
const SummaryContent = styled.div(({ theme }) => ({
  padding: "24px",
  [theme.breakpoints.up("md")]: {
    padding: "24px 32px",
  },
  [theme.breakpoints.down("sm")]: {
    padding: "16px",
  },
}))

const EnrollArea = styled.div(({ theme }) => ({
  padding: "8px 24px 24px",
  [theme.breakpoints.up("md")]: {
    padding: "8px 32px 24px",
  },
  [theme.breakpoints.between("sm", "md")]: {
    maxWidth: "50%",
    marginInline: "auto",
  },
  [theme.breakpoints.down("sm")]: {
    padding: "8px 16px 16px",
  },
}))

const AskTimButton = styled(Button)(({ theme }) => ({
  boxShadow: "0px 4px 8px 0px rgba(19, 20, 21, 0.08)",
  marginTop: "16px",
  width: "100%",
  [theme.breakpoints.between("sm", "md")]: {
    width: "auto",
  },
  color: theme.custom.colors.darkGray2,
  svg: {
    color: theme.custom.colors.mitRed,
  },
}))

const SELF_PACED = "self_paced"
const INSTRUCTOR_PACED = "instructor_paced"

const PACE_DATA = {
  [INSTRUCTOR_PACED]: {
    label: "Instructor-Paced",
    description:
      "Guided learning. Follow a set schedule with specific due dates for assignments and exams. Course materials released on a schedule. Earn your certificate shortly after the course ends.",
    href: "https://mitxonline.zendesk.com/hc/en-us/articles/21994938130075-What-are-Instructor-Paced-courses-on-MITx-Online",
  },
  [SELF_PACED]: {
    label: "Self-Paced",
    description:
      "Flexible learning. Enroll at any time and progress at your own speed. All course materials available immediately. Adaptable due dates and extended timelines. Earn your certificate as soon as you pass the course.",
    href: "https://mitxonline.zendesk.com/hc/en-us/articles/21994872904475-What-are-Self-Paced-courses-on-MITx-Online",
  },
}

const getCourseRunPacing = (run: CourseRunV2) => {
  return run.is_self_paced || run.is_archived ? SELF_PACED : INSTRUCTOR_PACED
}

export {
  ResponsiveLink,
  UnderlinedLink,
  InfoRow,
  InfoRowIcon,
  InfoRowInner,
  InfoLabel,
  InfoLabelValue,
  ButtonContainer,
  CertificateBoxRoot,
  GrayText,
  StrickenText,
  SummaryRows,
  LearnMoreDialog,
  SummaryCard,
  SummaryContent,
  EnrollArea,
  AskTimButton,
  SELF_PACED,
  INSTRUCTOR_PACED,
  PACE_DATA,
  getCourseRunPacing,
}
export type { InfoLabelProps, LearnMoreDialogProps }
