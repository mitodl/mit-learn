import React, { HTMLAttributes, useState } from "react"
import { ActionButton, Alert, styled } from "@mitodl/smoot-design"
import { productQueries } from "api/mitxonline-hooks/products"
import { Dialog, Link, Skeleton, Stack, theme, Typography } from "ol-components"
import type { StackProps } from "ol-components"
import {
  RiCalendarLine,
  RiComputerLine,
  RiPriceTag3Line,
  RiTimeLine,
  RiFileCopy2Line,
  RiInformation2Line,
} from "@remixicon/react"
import { formatDate, isInPast, LocalDate, NoSSR, pluralize } from "ol-utilities"
import type {
  CourseWithCourseRunsSerializerV2,
  CourseRunV2,
  V2ProgramDetail,
} from "@mitodl/mitxonline-api-axios/v2"
import { HeadingIds, parseReqTree } from "./util"
import { getCourseScenario } from "./courseRun"
import {
  formatPrice,
  getEnrollmentType,
  getFlexiblePriceForProduct,
  mitxonlineLegacyUrl,
  priceWithDiscount,
} from "@/common/mitxonline"
import { useQuery } from "@tanstack/react-query"
import { useUserIsAuthenticated } from "api/hooks/user"

const ResponsiveLink = styled(Link)(({ theme }) => ({
  ...theme.typography.body2, // override default for "black" color is subtitle2
  [theme.breakpoints.down("sm")]: {
    ...theme.typography.body3,
  },
}))

const UnderlinedLink = styled(ResponsiveLink)({
  textDecoration: "underline",
})

const SecondaryUnderlinedLink = styled(UnderlinedLink)(({ theme }) => ({
  ...theme.typography.body3,
  color: theme.custom.colors.silverGrayDark,
  [theme.breakpoints.down("sm")]: {
    ...theme.typography.body4,
  },
}))

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

const InfoLabel = styled.span<{
  underline?: boolean
  variant?: "light" | "normal"
}>(({ theme, underline, variant = "normal" }) => [
  variant === "normal" && {
    fontWeight: theme.typography.fontWeightBold,
  },
  variant === "light" && {
    color: theme.custom.colors.silverGrayDark,
  },
  underline && { textDecoration: "underline" },
])
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

const dateLoading = (
  <Skeleton variant="text" sx={{ display: "inline-block" }} width="80px" />
)

/**
 * Three-column grid for the session row: [calendar icon] [Session: label]
 * [dropdown]. `alignItems: center` vertically centers the icon and label with
 * the taller (40px) dropdown. The payment deadline tucks under the dropdown
 * (column 3, second row) regardless of the label's width.
 */
const SessionRow = styled.div(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "auto max-content 1fr",
  alignItems: "center",
  columnGap: "8px",
  rowGap: "8px",
  width: "100%",
  color: theme.custom.colors.darkGray2,
}))

const PaymentDeadline = styled.div(({ theme }) => ({
  ...theme.typography.body3,
  color: theme.custom.colors.darkGray2,
}))

/**
 * Compact block of secondary lines under the session dropdown — "Start Anytime"
 * (for a self-paced, already-open selected run; the collapsed dropdown value
 * shows dates only, so the anytime nature surfaces here) and the payment
 * deadline. A tight inter-line gap keeps them reading as one unit rather than
 * two airy grid rows; the 8px from the dropdown comes from the row's rowGap.
 */
const SessionSubText = styled.div(({ theme }) => ({
  ...theme.typography.body3,
  color: theme.custom.colors.darkGray2,
  display: "flex",
  flexDirection: "column",
  rowGap: "2px",
}))

const runStartsAnytime = (run: CourseRunV2) => {
  return (
    !run.is_archived &&
    run.is_self_paced &&
    run.start_date &&
    isInPast(run.start_date)
  )
}

type CourseInfoRowProps = {
  course: CourseWithCourseRunsSerializerV2
  nextRun?: CourseRunV2
} & HTMLAttributes<HTMLDivElement>
type NeedsNextRun = { nextRun: CourseRunV2 }
const CourseDatesRow: React.FC<
  CourseInfoRowProps & NeedsNextRun & { contentAvailableAnytime?: boolean }
> = ({ course, nextRun, contentAvailableAnytime, ...others }) => {
  const [expanded, setExpanded] = useState(false)
  const enrollable = course.courseruns
    .filter((cr) => cr.is_enrollable)
    .sort((a, b) => {
      if (!a.start_date || !b.start_date) return 0
      // Otherwise sort by start date
      return new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
    })

  const manyDates = enrollable.length > 1

  // Archived / deadline-passed courses are open-ended: content stays available,
  // so the single-run view leads with "available anytime" rather than a stale
  // start date, keeping the end date. (Multiple runs render their concrete
  // dates in the list.)
  if (contentAvailableAnytime && !manyDates) {
    return (
      <InfoRow {...others}>
        <InfoRowIcon>
          <RiCalendarLine aria-hidden="true" />
        </InfoRowIcon>
        <Stack gap="4px" width="100%">
          <InfoLabel>Course content available anytime</InfoLabel>
          {nextRun.end_date ? (
            <span>
              End: <LocalDate onSSR={dateLoading} date={nextRun.end_date} />
            </span>
          ) : null}
        </Stack>
      </InfoRow>
    )
  }

  return (
    <InfoRow {...others}>
      <InfoRowIcon>
        <RiCalendarLine aria-hidden="true" />
      </InfoRowIcon>
      <Stack gap="16px" width="100%">
        {manyDates ? (
          <InfoRowInner>
            <InfoLabel>Dates Available</InfoLabel>
            <UnderlinedLink
              target="_blank"
              rel="noopener noreferrer"
              color="black"
              href=""
              role="button"
              onClick={(event) => {
                event.preventDefault()
                setExpanded((current) => !current)
              }}
            >
              {expanded ? "Show Less" : "More Dates"}
            </UnderlinedLink>
          </InfoRowInner>
        ) : null}
        {enrollable
          .filter((cr) => expanded || cr.id === nextRun.id)
          .filter((cr) => cr.start_date)
          .map((cr) => {
            const anytime = runStartsAnytime(cr)
            const labelVariant = manyDates ? "light" : "normal"
            return (
              <Stack
                key={cr.id}
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                data-testid="date-entry"
              >
                <InfoLabelValue
                  label="Start"
                  value={
                    anytime ? (
                      "Anytime"
                    ) : (
                      <LocalDate onSSR={dateLoading} date={cr.start_date} />
                    )
                  }
                  labelVariant={labelVariant}
                />
                {cr.end_date ? (
                  <InfoLabelValue
                    label="End"
                    value={<LocalDate onSSR={dateLoading} date={cr.end_date} />}
                    labelVariant={labelVariant}
                  />
                ) : null}
              </Stack>
            )
          })}
      </Stack>
    </InfoRow>
  )
}

type LearnMoreDialogProps = {
  buttonText?: string
  href: string
  description: string
  title: string
  iconOnly?: boolean
}

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

const LearnMoreDialog: React.FC<LearnMoreDialogProps> = ({
  buttonText,
  href,
  description,
  title,
  iconOnly = false,
}) => {
  const [open, setOpen] = React.useState(false)
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
const CoursePaceRow: React.FC<CourseInfoRowProps & NeedsNextRun> = ({
  nextRun,
  ...others
}) => {
  const paceCode = getCourseRunPacing(nextRun)
  const pace = PACE_DATA[paceCode]

  return (
    <InfoRow {...others}>
      <InfoRowIcon>
        <RiComputerLine aria-hidden="true" />
      </InfoRowIcon>
      <InfoRowInner>
        <InfoLabelValue
          label="Format"
          value={
            <>
              {pace.label}
              <LearnMoreDialog
                href={pace.href}
                description={pace.description}
                title={`What are ${pace.label} courses?`}
                iconOnly
              />
            </>
          }
        />
      </InfoRowInner>
    </InfoRow>
  )
}

const CourseDurationRow: React.FC<CourseInfoRowProps> = ({
  course,
  ...others
}) => {
  const duration = course.page?.length ?? ""
  const effort = course.page?.effort ?? ""
  if (!duration) return null
  const display = [duration, effort].filter(Boolean).join(", ")
  return (
    <InfoRow {...others}>
      <InfoRowIcon>
        <RiTimeLine aria-hidden="true" />
      </InfoRowIcon>
      <InfoRowInner>
        <InfoLabelValue label="Estimated" value={display} />
      </InfoRowInner>
    </InfoRow>
  )
}

const ProgramPaySection = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "12px",
  width: "346px",
  alignSelf: "stretch",
  flex: "none",
  color: theme.custom.colors.darkGray2,
}))

const ProgramPayLabel = styled.span(({ theme }) => ({
  ...theme.typography.subtitle3,
  color: theme.custom.colors.silverGrayDark,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
}))

/** Horizontal row: [current price block] | [vertical divider] | [list price block] */
const ProgramPriceRowInner = styled.div({
  display: "flex",
  flexDirection: "row" as const,
  alignItems: "flex-end" as const,
  gap: "24px",
})

const ProgramCurrentPriceBlock = styled.div({
  display: "flex",
  flexDirection: "column" as const,
  justifyContent: "flex-end" as const,
  alignItems: "flex-start" as const,
})

const ProgramPriceAmount = styled.span(({ theme }) => ({
  ...theme.typography.subtitle2,
  fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
  fontWeight: theme.typography.fontWeightBold,
  fontSize: "34px",
  lineHeight: "40px",
  color: theme.custom.colors.darkGray2,
}))

const ProgramPriceSuffix = styled.span(({ theme }) => ({
  ...theme.typography.body3,
  color: theme.custom.colors.silverGrayDark,
}))

const ProgramVerticalDivider = styled.div(() => ({
  width: "1px",
  height: "48px",
  backgroundColor: theme.custom.colors.lightGray2,
  flexShrink: 0,
}))

const ProgramListPriceBlock = styled.div({
  display: "flex",
  flexDirection: "column" as const,
  justifyContent: "flex-end" as const,
  alignItems: "flex-start" as const,
})

const ProgramListPriceAmount = styled.span({
  ...theme.typography.body3,
  fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
  fontSize: "28px",
  lineHeight: "36px",
  display: "flex",
  alignItems: "flex-end" as const,
  textDecoration: "line-through",
  color: theme.custom.colors.silverGrayDark,
})

const ProgramListPriceSubLabel = styled.span({
  ...theme.typography.body3,
  color: theme.custom.colors.silverGrayDark,
})

/** Inline row: "Save $X  compared to purchasing N courses separately" */
const ProgramDiscountRow = styled.div({
  display: "flex",
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: "4px",
  width: "100%",
})

const ProgramSavingsText = styled.span({
  ...theme.typography.subtitle3,
  fontWeight: theme.typography.fontWeightBold,
  color: "#008000",
})

const ProgramSavingsDetailText = styled.span({
  ...theme.typography.body3,
  color: theme.custom.colors.silverGrayDark,
})

const ProgramPriceDivider = styled.div(({ theme }) => ({
  width: "100%",
  maxWidth: "346px",
  borderTop: `1px solid ${theme.custom.colors.lightGray2}`,
  marginBottom: "20px",
  flex: "none",
  alignSelf: "stretch",
}))

const ProgramStartForFreeBox = styled.div((_theme) => ({
  display: "flex",
  alignItems: "center",
  gap: "8px",
  padding: "8px 16px",
  borderRadius: "8px",
  background:
    "linear-gradient(0deg, rgba(255, 255, 255, 0.94), rgba(255, 255, 255, 0.94)), #004D1A",
}))

const ProgramStartForFreeIcon = styled.svg(() => ({
  width: "24px",
  height: "24px",
  flexShrink: 0,
  path: {
    fill: "#008000",
  },
}))

const ProgramStartForFreeTextContainer = styled.span(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: "4px",
  ...theme.typography.body2,
}))

const ProgramStartForFreeTextStrong = styled.span({
  ...theme.typography.subtitle2,
  color: "#008000",
})

const ProgramStartForFreeTextRegular = styled.span({
  ...theme.typography.body2,
  color: theme.custom.colors.darkGray2,
})

const ProgramStartForFreeInfoIcon = styled.span(({ theme }) => ({
  display: "inline-flex",
  alignItems: "center",
  flexShrink: 0,
  color: theme.custom.colors.silverGrayDark,
  "& svg": {
    width: "20px",
    height: "20px",
  },
}))

const StrickenText = styled.span(({ theme }) => ({
  textDecoration: "line-through",
  color: theme.custom.colors.silverGrayDark,
  ...theme.typography.body3,
  [theme.breakpoints.down("sm")]: {
    ...theme.typography.body4,
  },
}))

enum TestIds {
  DatesRow = "dates-row",
  PaceRow = "pace-row",
  DurationRow = "duration-row",
  PriceRow = "price-row",
  RequirementsRow = "requirements-row",
}

const ArchivedAlert: React.FC = () => {
  return (
    <Alert severity="warning">
      This course is no longer active, but you can still access selected
      content.{" "}
      <LearnMoreDialog
        buttonText="Learn more"
        href="https://mitxonline.zendesk.com/hc/en-us/articles/21995114519067-What-are-Archived-courses-on-MITx-Online-"
        description="Access lectures and readings beyond the official end date. Some course assignments and exams may be unavailable. No support in course discussion forums. Cannot earn a Course Certificate."
        title="What are Archived courses?"
      />
    </Alert>
  )
}

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

const CourseSummary: React.FC<{
  course: CourseWithCourseRunsSerializerV2
  selectedRun: CourseRunV2 | undefined
  sessionSelect?: React.ReactNode
}> = ({ course, selectedRun, sessionSelect }) => {
  const scenario = getCourseScenario(selectedRun)
  // Archived courses have no live schedule, so the date row leads with "content
  // available anytime" + end date instead of dates. A deadline-passed run is
  // still an active, scheduled run — it keeps its normal date row (dropdown /
  // "anytime" / dated); only the now-stale payment-deadline line is dropped,
  // since the "Certificate deadline has passed." alert conveys that.
  const contentAvailableAnytime = scenario === "archived"
  const selectedRunStartsAnytime = !!(
    selectedRun && runStartsAnytime(selectedRun)
  )
  const suppressPaymentDeadline =
    scenario === "archived" || scenario === "deadlinePassed"
  const upgradeDeadline =
    selectedRun !== undefined && !suppressPaymentDeadline
      ? selectedRun.upgrade_deadline
      : null
  const deadlineContent = upgradeDeadline ? (
    <>
      Payment deadline:{" "}
      <NoSSR onSSR={dateLoading}>{formatDate(upgradeDeadline)}</NoSSR>
    </>
  ) : null

  return (
    <SummaryRows>
      {selectedRun ? (
        <CoursePaceRow
          course={course}
          nextRun={selectedRun}
          data-testid={TestIds.PaceRow}
        />
      ) : null}
      <CourseDurationRow
        course={course}
        nextRun={selectedRun}
        data-testid={TestIds.DurationRow}
      />
      {selectedRun ? (
        sessionSelect ? (
          <SessionRow data-testid={TestIds.DatesRow}>
            <InfoRowIcon>
              <RiCalendarLine aria-hidden="true" />
            </InfoRowIcon>
            {sessionSelect}
            {selectedRunStartsAnytime || deadlineContent ? (
              <SessionSubText style={{ gridColumn: 3 }}>
                {selectedRunStartsAnytime ? <div>Start Anytime</div> : null}
                {deadlineContent ? <div>{deadlineContent}</div> : null}
              </SessionSubText>
            ) : null}
          </SessionRow>
        ) : (
          <Stack gap="8px" width="100%">
            <CourseDatesRow
              course={course}
              nextRun={selectedRun}
              contentAvailableAnytime={contentAvailableAnytime}
              data-testid={TestIds.DatesRow}
            />
            {deadlineContent ? (
              <PaymentDeadline style={{ paddingLeft: "28px" }}>
                {deadlineContent}
              </PaymentDeadline>
            ) : null}
          </Stack>
        )
      ) : null}
      {/* Degraded-state notices sit at the bottom of the metadata block, just
          above the offerings, matching Figma (the spec pinned the row order and
          the notice copy but not the notice's vertical placement). */}
      {!selectedRun ? (
        <Alert severity="warning">
          No sessions of this course are currently open for enrollment. More
          sessions may be added in the future.
        </Alert>
      ) : null}
      {selectedRun?.is_archived ? <ArchivedAlert /> : null}
      {scenario === "deadlinePassed" ? (
        <Alert severity="warning">Certificate deadline has passed.</Alert>
      ) : null}
    </SummaryRows>
  )
}

type ProgramInfoRowProps = {
  program: V2ProgramDetail
} & HTMLAttributes<HTMLDivElement>

const getTotalRequiredCourses = (program: V2ProgramDetail) => {
  const parsedReqs = parseReqTree(program.req_tree)
  return parsedReqs.reduce((sum, req) => sum + req.requiredCount, 0)
}

const RequirementsRow: React.FC<ProgramInfoRowProps> = ({
  program,
  ...others
}) => {
  const totalRequired = getTotalRequiredCourses(program)
  if (totalRequired === 0) return null

  // Always say "Courses" here. Whether a child program should be labeled
  // as a "course" or "program" depends on its display_mode, which can't be
  // determined from the req_tree alone. The important use cases are course
  // and course-like program (display_mode="Course") children only.
  return (
    <InfoRow {...others}>
      <InfoRowIcon>
        <RiFileCopy2Line aria-hidden="true" />
      </InfoRowIcon>

      <InfoRowInner>
        <ResponsiveLink color="black" href={`#${HeadingIds.Requirements}`}>
          <InfoLabel underline>
            {`${totalRequired} ${pluralize("Course", totalRequired)}`}
          </InfoLabel>{" "}
          to complete program
        </ResponsiveLink>
      </InfoRowInner>
    </InfoRow>
  )
}

const ProgramDurationRow: React.FC<ProgramInfoRowProps> = ({
  program,
  ...others
}) => {
  const duration = program.page?.length ?? ""
  const effort = program.page?.effort ?? ""
  if (!duration) return null
  const display = [duration, effort].filter(Boolean).join(", ")

  return (
    <InfoRow {...others}>
      <InfoRowIcon>
        <RiTimeLine aria-hidden="true" />
      </InfoRowIcon>
      <InfoRowInner>
        <InfoLabelValue label="Estimated" value={display} />
      </InfoRowInner>
    </InfoRow>
  )
}

const getProgramPacing = (
  programCourses: CourseWithCourseRunsSerializerV2[],
) => {
  const programCourseRuns = programCourses
    .map((c) => c.courseruns.find((cr) => cr.id === c.next_run_id))
    .filter((cr) => cr !== undefined)

  if (programCourseRuns.length === 0) return null
  return programCourseRuns.every((cr) => getCourseRunPacing(cr) === SELF_PACED)
    ? SELF_PACED
    : INSTRUCTOR_PACED
}

const ProgramPaceRow: React.FC<
  {
    courses?: CourseWithCourseRunsSerializerV2[]
  } & HTMLAttributes<HTMLDivElement>
> = ({ courses, ...others }) => {
  const paceCode = courses?.length ? getProgramPacing(courses) : null
  const pace = paceCode ? PACE_DATA[paceCode] : null
  if (!pace) return null
  return (
    <InfoRow {...others}>
      <InfoRowIcon>
        <RiComputerLine aria-hidden="true" />
      </InfoRowIcon>
      <InfoRowInner>
        <InfoLabelValue
          label="Course Format"
          value={
            <>
              {pace.label}
              <LearnMoreDialog
                href={pace.href}
                description={pace.description}
                title={`What are ${pace.label} courses?`}
                iconOnly
              />
            </>
          }
        />
      </InfoRowInner>
    </InfoRow>
  )
}

const PROGRAM_CERT_INFO_HREF =
  "https://mitxonline.zendesk.com/hc/en-us/articles/28158506908699-What-is-the-Certificate-Track-What-are-Course-and-Program-Certificates"

type ProgramPriceRowProps = HTMLAttributes<HTMLDivElement> & {
  program: V2ProgramDetail
}
const ProgramPriceRow: React.FC<ProgramPriceRowProps> = ({
  program,
  ...others
}) => {
  const enrollmentType = getEnrollmentType(program.enrollment_modes)
  const isAuthenticated = useUserIsAuthenticated()

  const product = program.products[0]
  const currentPrice = product?.price
  const listPrice = program.page?.list_price
  const financialAidUrl = program.page?.financial_assistance_form_url
  const hasFinancialAid = !!(financialAidUrl && product)
  const userFlexiblePrice = useQuery({
    ...productQueries.userFlexiblePriceDetail({ productId: product?.id ?? 0 }),
    enabled:
      (enrollmentType === "paid" || enrollmentType === "both") &&
      isAuthenticated &&
      hasFinancialAid,
  })

  if (enrollmentType === "none") return null
  const price = product
    ? priceWithDiscount({
        product,
        flexiblePrice: userFlexiblePrice.data,
        avoidCents: true,
      })
    : null

  const currentAmount =
    userFlexiblePrice.data && price?.isDiscounted
      ? getFlexiblePriceForProduct(userFlexiblePrice.data)
      : toNumericPrice(currentPrice)
  const listAmount = toNumericPrice(listPrice)
  const hasSavings =
    currentAmount !== null && listAmount !== null && listAmount > currentAmount
  const savingsAmount = hasSavings ? listAmount - currentAmount : null

  const totalRequired = getTotalRequiredCourses(program)

  const paidSection = currentPrice ? (
    <ProgramPaySection>
      <ProgramPayLabel>Price</ProgramPayLabel>
      <ProgramPriceRowInner>
        <ProgramCurrentPriceBlock
          {...(price?.isDiscounted
            ? {
                role: "group",
                "aria-label": `Discounted price: ${price.finalPrice}, was ${price.originalPrice}`,
              }
            : {})}
        >
          <ProgramPriceAmount aria-hidden={price?.isDiscounted || undefined}>
            {price?.isDiscounted ? (
              <>
                {price.finalPrice}{" "}
                <StrickenText>{price.originalPrice}</StrickenText>
              </>
            ) : (
              formatPrice(currentPrice, { avoidCents: true })
            )}
          </ProgramPriceAmount>
          <ProgramPriceSuffix>full program</ProgramPriceSuffix>
        </ProgramCurrentPriceBlock>
        {hasSavings && listAmount !== null ? (
          <>
            <ProgramVerticalDivider />
            <ProgramListPriceBlock
              role="group"
              aria-label={`Original price: ${formatPrice(listAmount, { avoidCents: true })} purchased separately`}
            >
              <ProgramListPriceAmount aria-hidden="true">
                {formatPrice(listAmount, { avoidCents: true })}
              </ProgramListPriceAmount>
              <ProgramListPriceSubLabel aria-hidden="true">
                purchased separately
              </ProgramListPriceSubLabel>
            </ProgramListPriceBlock>
          </>
        ) : null}
      </ProgramPriceRowInner>
      {hasSavings && savingsAmount !== null ? (
        <ProgramDiscountRow>
          <ProgramSavingsText>
            Save {formatPrice(savingsAmount, { avoidCents: true })}
          </ProgramSavingsText>
          <ProgramSavingsDetailText>
            compared to purchasing {totalRequired}{" "}
            {pluralize("course", totalRequired)} separately
          </ProgramSavingsDetailText>
        </ProgramDiscountRow>
      ) : null}
      {hasFinancialAid ? (
        <SecondaryUnderlinedLink
          color="black"
          href={mitxonlineLegacyUrl(financialAidUrl!)}
          target="_blank"
          rel="noopener noreferrer"
          style={{ minWidth: "fit-content" }}
        >
          {price?.approvedFinancialAid
            ? "Financial assistance applied"
            : "Financial assistance available"}
        </SecondaryUnderlinedLink>
      ) : null}
      {enrollmentType === "both" ? (
        <ProgramStartForFreeBox>
          <ProgramStartForFreeIcon
            width="24"
            height="24"
            viewBox="0 0 22 19"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path d="M14 0C16.2091 0 18 1.79086 18 4C18 4.72903 17.8049 5.41251 17.4642 6.00111L22 6V7.99999H20V18C20 18.5523 19.5523 19 19 19H3C2.44772 19 2 18.5523 2 18V7.99999H0V6L4.53577 6.00111C4.19504 5.41251 4 4.72903 4 4C4 1.79086 5.79086 0 8 0C9.19522 0 10.268 0.52421 11.0009 1.35526C11.732 0.52421 12.8048 0 14 0ZM10 7.99999H4V17H10V7.99999ZM18 7.99999H12V17H18V7.99999ZM8 2C6.89543 2 6 2.89543 6 4C6 5.05436 6.81588 5.91816 7.85074 5.99451L8 6H10V4C10 2.99835 9.26372 2.16869 8.30278 2.02277L8.14927 2.00548L8 2ZM14 2C12.9456 2 12.0818 2.81588 12.0055 3.85074L12 4V6H14C15.0543 6 15.9181 5.18412 15.9945 4.14926L16 4C16 2.89543 15.1046 2 14 2Z" />
          </ProgramStartForFreeIcon>
          <ProgramStartForFreeTextContainer>
            <ProgramStartForFreeTextStrong>
              Audit for free
            </ProgramStartForFreeTextStrong>
            <ProgramStartForFreeTextRegular>
              or upgrade to certificate
            </ProgramStartForFreeTextRegular>
          </ProgramStartForFreeTextContainer>
          <a
            href={PROGRAM_CERT_INFO_HREF}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Learn more about program certificates"
            style={{ display: "inline-flex", alignItems: "center" }}
          >
            <ProgramStartForFreeInfoIcon>
              <RiInformation2Line aria-hidden="true" />
            </ProgramStartForFreeInfoIcon>
          </a>
        </ProgramStartForFreeBox>
      ) : null}
    </ProgramPaySection>
  ) : (
    <InfoLabelValue label="Price" value="Price unavailable" />
  )

  return (
    <Stack {...others} gap="0px" width="100%">
      {enrollmentType === "paid" || enrollmentType === "both" ? (
        <ProgramPriceDivider />
      ) : null}
      <InfoRow>
        {enrollmentType === "paid" || enrollmentType === "both" ? (
          paidSection
        ) : (
          <>
            <InfoRowIcon>
              <RiPriceTag3Line aria-hidden="true" />
            </InfoRowIcon>
            <InfoRowInner>
              <InfoLabelValue label="Price" value="Free to Learn" />
            </InfoRowInner>
          </>
        )}
      </InfoRow>
    </Stack>
  )
}

const toNumericPrice = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

const ProgramSummary: React.FC<{
  program: V2ProgramDetail
  /**
   * Avoid using this. Ideally, ProgramSummary should be based on `program` data.
   */
  courses?: CourseWithCourseRunsSerializerV2[]
}> = ({ program, courses }) => {
  return (
    <SummaryRows>
      <RequirementsRow
        program={program}
        data-testid={TestIds.RequirementsRow}
      />
      <ProgramDurationRow program={program} data-testid={TestIds.DurationRow} />
      <ProgramPaceRow courses={courses} data-testid={TestIds.PaceRow} />
      <ProgramPriceRow data-testid={TestIds.PriceRow} program={program} />
    </SummaryRows>
  )
}

const ProgramAsCourseSummary: React.FC<{
  program: V2ProgramDetail
  courses?: CourseWithCourseRunsSerializerV2[]
}> = ({ program, courses }) => {
  return (
    <SummaryRows>
      <ProgramDurationRow program={program} data-testid={TestIds.DurationRow} />
      <ProgramPaceRow courses={courses} data-testid={TestIds.PaceRow} />
    </SummaryRows>
  )
}

export {
  CourseSummary,
  ProgramSummary,
  ProgramAsCourseSummary,
  ProgramDurationRow,
  ProgramPaceRow,
  ProgramPriceRow,
  SummaryRows,
  UnderlinedLink,
  TestIds,
}
