import React, { HTMLAttributes, useState } from "react"
import { ActionButton, Alert, styled } from "@mitodl/smoot-design"
import { productQueries } from "api/mitxonline-hooks/products"
import { Dialog, Link, Skeleton, Stack, Typography } from "ol-components"
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
import {
  canPurchaseRun,
  formatPrice,
  getEnrollmentType,
  mitxonlineLegacyUrl,
  priceWithDiscount,
} from "@/common/mitxonline"
import { useQuery } from "@tanstack/react-query"

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
const CourseDatesRow: React.FC<CourseInfoRowProps & NeedsNextRun> = ({
  course,
  nextRun,
  ...others
}) => {
  const [expanded, setExpanded] = useState(false)
  const enrollable = course.courseruns
    .filter((cr) => cr.is_enrollable)
    .sort((a, b) => {
      if (!a.start_date || !b.start_date) return 0
      // Otherwise sort by start date
      return new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
    })

  const manyDates = enrollable.length > 1

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
          .filter((cr) => expanded || cr.id === course.next_run_id)
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

const COURSE_CERT_INFO_HREF =
  "https://mitxonline.zendesk.com/hc/en-us/articles/28158506908699-What-is-the-Certificate-Track-What-are-Course-and-Program-Certificates"
const COURSE_CERT_INFO_LINK = (
  <UnderlinedLink
    color="black"
    href={COURSE_CERT_INFO_HREF}
    target="_blank"
    rel="noopener noreferrer"
  >
    Learn More
  </UnderlinedLink>
)

const GrayText = styled.span(({ theme }) => ({
  color: theme.custom.colors.silverGrayDark,
}))

const ProgramPaySection = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "4px",
  width: "346px",
  alignSelf: "stretch",
  flex: "none",
  color: theme.custom.colors.darkGray2,
}))

const ProgramPayLabel = styled.span(({ theme }) => ({
  ...theme.typography.body4,
  fontSize: "12px",
  lineHeight: "16px",
  fontWeight: theme.typography.fontWeightMedium,
  color: theme.custom.colors.silverGrayDark,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  width: "100%",
  alignSelf: "stretch",
}))

const ProgramPayContent = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "12px",
  width: "100%",
  maxWidth: "320px",
  [theme.breakpoints.down("sm")]: {
    maxWidth: "100%",
  },
}))

const ProgramPriceLine = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "flex-end",
  gap: "4px",
  flexWrap: "wrap",
  color: theme.custom.colors.darkGray2,
}))

const ProgramPriceAmount = styled.span(({ theme }) => ({
  ...theme.typography.h3,
  fontWeight: theme.typography.fontWeightBold,
  lineHeight: "36px",
}))

const ProgramPriceSuffix = styled.span(({ theme }) => ({
  ...theme.typography.subtitle1,
  fontWeight: theme.typography.fontWeightMedium,
  fontSize: "18px",
  lineHeight: "26px",
  color: theme.custom.colors.silverGrayDark,
}))

const ProgramDiscountBlock = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "flex-start",
  gap: "8px",
  color: theme.custom.colors.darkGray2,
}))

const ProgramSavingsText = styled.span(({ theme }) => ({
  ...theme.typography.subtitle2,
  color: "#008000",
  fontSize: "16px",
  lineHeight: "24px",
  fontWeight: theme.typography.fontWeightBold,
}))

const ProgramListPriceText = styled.span(({ theme }) => ({
  ...theme.typography.body2,
  fontSize: "14px",
  lineHeight: "18px",
  fontWeight: theme.typography.fontWeightMedium,
  color: theme.custom.colors.silverGrayDark,
}))

const ProgramListPriceAmount = styled.span({
  textDecoration: "line-through",
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
  "path": {
    fill: "#008000",
  },
}))

const ProgramStartForFreeTextContainer = styled.span(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: "4px",
  ...theme.typography.body2,
}))

const ProgramStartForFreeTextStrong = styled.span(({ theme }) => ({
  color: "#008000",
  fontWeight: theme.typography.fontWeightMedium,
}))

const ProgramStartForFreeTextRegular = styled.span(({ theme }) => ({
  color: theme.custom.colors.darkGray2,
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

const StrickenText = styled.span(({ theme }) => ({
  textDecoration: "line-through",
  color: theme.custom.colors.silverGrayDark,
  ...theme.typography.body3,
  [theme.breakpoints.down("sm")]: {
    ...theme.typography.body4,
  },
}))

const CourseCertificateBox: React.FC<CourseInfoRowProps> = ({
  nextRun,
  course,
}) => {
  const canPurchase = nextRun ? canPurchaseRun(nextRun) : false
  const product = nextRun?.products[0]
  const financialAidUrl = course?.page?.financial_assistance_form_url
  const hasFinancialAid = !!(financialAidUrl && product)
  const userFlexiblePrice = useQuery({
    ...productQueries.userFlexiblePriceDetail({ productId: product?.id ?? 0 }),
    enabled: canPurchase && hasFinancialAid,
  })
  const price =
    canPurchase && product
      ? priceWithDiscount({
          product,
          flexiblePrice: userFlexiblePrice.data,
          avoidCents: true,
        })
      : null

  const upgradeDeadline = nextRun?.is_archived
    ? null
    : nextRun?.upgrade_deadline
  return (
    <CertificateBoxRoot>
      {price ? (
        <>
          <InfoRowInner flexWrap={"nowrap"}>
            <span>
              <UnderlinedLink
                href={COURSE_CERT_INFO_HREF}
                target="_blank"
                rel="noopener noreferrer"
                color="black"
              >
                <InfoLabel>Earn a certificate</InfoLabel>
              </UnderlinedLink>
              :{" "}
              {price.isDiscounted ? (
                <>
                  {price.finalPrice}{" "}
                  <StrickenText>{price.originalPrice}</StrickenText>
                </>
              ) : (
                price.finalPrice
              )}
            </span>
          </InfoRowInner>
          {hasFinancialAid ? (
            <UnderlinedLink
              color="black"
              href={mitxonlineLegacyUrl(financialAidUrl)}
              target="_blank"
              rel="noopener noreferrer"
            >
              {price.approvedFinancialAid
                ? "Financial assistance applied"
                : "Financial assistance available"}
            </UnderlinedLink>
          ) : null}
          {upgradeDeadline ? (
            <Typography
              typography={{ xs: "body3", sm: "body2" }}
              sx={(theme) => ({ color: theme.custom.colors.red })}
            >
              Payment deadline:{" "}
              <NoSSR
                onSSR={
                  <Skeleton
                    variant="text"
                    sx={{ display: "inline-block" }}
                    width="80px"
                  />
                }
              >
                {formatDate(upgradeDeadline)}
              </NoSSR>
            </Typography>
          ) : null}
        </>
      ) : (
        <InfoRowInner>
          <Typography typography={{ xs: "subtitle3", sm: "subtitle2" }}>
            Certificate deadline passed
          </Typography>
          {COURSE_CERT_INFO_LINK}
        </InfoRowInner>
      )}
    </CertificateBoxRoot>
  )
}

const CoursePriceRow: React.FC<CourseInfoRowProps> = ({
  course,
  nextRun,
  ...others
}) => {
  const enrollmentType = getEnrollmentType(nextRun?.enrollment_modes)
  const product = nextRun?.products[0]
  const canPurchase = nextRun ? canPurchaseRun(nextRun) : false
  const financialAidUrl = course?.page?.financial_assistance_form_url
  const hasFinancialAid = !!(financialAidUrl && product)
  const userFlexiblePrice = useQuery({
    ...productQueries.userFlexiblePriceDetail({ productId: product?.id ?? 0 }),
    enabled: enrollmentType === "paid" && canPurchase && hasFinancialAid,
  })
  const price =
    enrollmentType === "paid" && product
      ? priceWithDiscount({
          product,
          flexiblePrice: userFlexiblePrice.data,
          avoidCents: true,
        })
      : null

  if (enrollmentType === "none") return null

  const paidPrice = price ? (
    <>
      {price.isDiscounted ? (
        <>
          {price.finalPrice} <StrickenText>{price.originalPrice}</StrickenText>
        </>
      ) : (
        price.finalPrice
      )}{" "}
      <GrayText>(includes {course.certificate_type})</GrayText>
    </>
  ) : null

  return (
    <InfoRow {...others}>
      <InfoRowIcon>
        <RiPriceTag3Line aria-hidden="true" />
      </InfoRowIcon>
      <Stack gap="8px" width="100%">
        {enrollmentType === "paid" ? (
          <>
            <InfoLabelValue label="Price" value={paidPrice} />
            {canPurchase && hasFinancialAid ? (
              <UnderlinedLink
                color="black"
                href={mitxonlineLegacyUrl(financialAidUrl)}
                target="_blank"
                rel="noopener noreferrer"
              >
                {price?.approvedFinancialAid
                  ? "Financial assistance applied"
                  : "Financial assistance available"}
              </UnderlinedLink>
            ) : null}
          </>
        ) : (
          <InfoLabelValue label="Price" value="Free to Learn" />
        )}
        {enrollmentType === "both" ? (
          <CourseCertificateBox course={course} nextRun={nextRun} />
        ) : null}
      </Stack>
    </InfoRow>
  )
}

enum TestIds {
  DatesRow = "dates-row",
  PaceRow = "pace-row",
  DurationRow = "duration-row",
  PriceRow = "price-row",
  RequirementsRow = "requirements-row",
  CertificateTrackRow = "certificate-track-row",
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
}> = ({ course }) => {
  const nextRunId = course.next_run_id
  const nextRun = course.courseruns.find((run) => run.id === nextRunId)
  return (
    <SummaryRows>
      {!nextRun ? (
        <Alert severity="warning">
          No sessions of this course are currently open for enrollment. More
          sessions may be added in the future.
        </Alert>
      ) : null}
      {nextRun?.is_archived ? <ArchivedAlert /> : null}
      {nextRun ? (
        <CourseDatesRow
          course={course}
          nextRun={nextRun}
          data-testid={TestIds.DatesRow}
        />
      ) : null}
      {nextRun ? (
        <CoursePaceRow
          course={course}
          nextRun={nextRun}
          data-testid={TestIds.PaceRow}
        />
      ) : null}
      <CourseDurationRow
        course={course}
        nextRun={nextRun}
        data-testid={TestIds.DurationRow}
      />
      <CoursePriceRow
        course={course}
        nextRun={nextRun}
        data-testid={TestIds.PriceRow}
      />
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
  const duration = program.page.length ?? ""
  const effort = program.page.effort ?? ""
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
  if (enrollmentType === "none") return null

  const currentPrice = program.products[0]?.price
  const listPrice = program.page.list_price

  const currentAmount = toNumericPrice(currentPrice)
  const listAmount = toNumericPrice(listPrice)
  const hasSavings =
    currentAmount !== null && listAmount !== null && listAmount > currentAmount
  const savingsAmount = hasSavings ? listAmount - currentAmount : null

  const totalRequired = getTotalRequiredCourses(program)

  const paidSection =
    currentPrice ? (
      <ProgramPaySection>
        <ProgramPayLabel>Price</ProgramPayLabel>
        <ProgramPayContent>
          <ProgramPriceLine>
            <ProgramPriceAmount>
              {formatPrice(currentPrice, { avoidCents: true })}
            </ProgramPriceAmount>
            <ProgramPriceSuffix>/ full program</ProgramPriceSuffix>
          </ProgramPriceLine>
          {hasSavings && savingsAmount !== null && listAmount !== null ? (
            <ProgramDiscountBlock>
              <ProgramSavingsText>
                Save {formatPrice(savingsAmount, { avoidCents: true })}
              </ProgramSavingsText>
              <ProgramListPriceText>
                <ProgramListPriceAmount>
                  {formatPrice(listAmount, { avoidCents: true })}
                </ProgramListPriceAmount>{" "}
                total for{" "}
                {totalRequired} {pluralize("course", totalRequired)} purchased
                separately
              </ProgramListPriceText>
            </ProgramDiscountBlock>
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
                  Start for free
                </ProgramStartForFreeTextStrong>
                <ProgramStartForFreeTextRegular>
                  or upgrade to certificate
                </ProgramStartForFreeTextRegular>
              </ProgramStartForFreeTextContainer>
            </ProgramStartForFreeBox>
          ) : null}
          {program.page.financial_assistance_form_url ? (
          <UnderlinedLink
            color="black"
            href={mitxonlineLegacyUrl(program.page.financial_assistance_form_url)}
            target="_blank"
            rel="noopener noreferrer"
            style={{ minWidth: "fit-content" }}
          >
            Financial assistance available
          </UnderlinedLink>
        ) : null}
        </ProgramPayContent>
      </ProgramPaySection>
    ) : (
      <InfoLabelValue label="Price" value="Price unavailable" />
    )

  return (
    <Stack {...others} gap="0px" width="100%">
      {enrollmentType === "paid" || enrollmentType === "both" ? <ProgramPriceDivider /> : null}
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
      <ProgramPriceRow data-testid={TestIds.PriceRow} program={program} />
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
