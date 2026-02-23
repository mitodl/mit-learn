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
  RiMenuAddLine,
  RiInformation2Line,
} from "@remixicon/react"
import { formatDate, isInPast, LocalDate, NoSSR, pluralize } from "ol-utilities"
import type {
  CourseWithCourseRunsSerializerV2,
  CourseRunV2,
  V2Program,
} from "@mitodl/mitxonline-api-axios/v2"
import { HeadingIds, parseReqTree } from "./util"
import {
  canUpgradeRun,
  mitxonlineUrl,
  priceWithDiscount,
} from "@/common/mitxonline"
import { useQuery } from "@tanstack/react-query"
import { programPageView } from "@/common/urls"

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
  const duration = course.page.length ?? ""
  const effort = course.page.effort ?? ""
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

const CourseCertificateBox: React.FC<CourseInfoRowProps & {}> = ({
  nextRun,
  course,
}) => {
  const canUpgrade = nextRun ? canUpgradeRun(nextRun) : false
  const product = nextRun?.products[0]
  const hasFinancialAid = !!(
    course?.page.financial_assistance_form_url && product
  )
  const userFlexiblePrice = useQuery({
    ...productQueries.userFlexiblePriceDetail({ productId: product?.id ?? 0 }),
    enabled: canUpgrade && hasFinancialAid,
  })
  const price =
    canUpgrade && product
      ? priceWithDiscount({ product, flexiblePrice: userFlexiblePrice.data })
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
              href={mitxonlineUrl(course.page.financial_assistance_form_url)}
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
  return (
    <InfoRow {...others}>
      <InfoRowIcon>
        <RiPriceTag3Line aria-hidden="true" />
      </InfoRowIcon>
      <Stack gap="8px" width="100%">
        <InfoLabelValue label="Price" value="Free to Learn" />
        <CourseCertificateBox course={course} nextRun={nextRun} />
      </Stack>
    </InfoRow>
  )
}

const CourseInProgramsRow: React.FC<CourseInfoRowProps> = ({
  course,
  ...others
}) => {
  if (!course.programs || course.programs.length === 0) return null
  const label = `Part of the following ${pluralize("program", course.programs.length)}`
  return (
    <InfoRow {...others}>
      <InfoRowIcon>
        <RiMenuAddLine aria-hidden="true" />
      </InfoRowIcon>
      <InfoRowInner>
        <Stack gap="4px">
          <InfoLabel>{label}</InfoLabel>
          {course.programs.map((p) => (
            <UnderlinedLink
              color="black"
              key={p.readable_id}
              href={programPageView(p.readable_id)}
            >
              {p.title}
            </UnderlinedLink>
          ))}
        </Stack>
      </InfoRowInner>
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
  CourseInProgramsRow = "course-in-programs-row",
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

const CourseSummary: React.FC<{
  course: CourseWithCourseRunsSerializerV2
}> = ({ course }) => {
  const nextRunId = course.next_run_id
  const nextRun = course.courseruns.find((run) => run.id === nextRunId)
  return (
    <Stack gap={{ xs: "24px", md: "32px" }}>
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
      <CourseInProgramsRow
        course={course}
        nextRun={nextRun}
        data-testid={TestIds.CourseInProgramsRow}
      />
    </Stack>
  )
}

type ProgramInfoRowProps = {
  program: V2Program
} & HTMLAttributes<HTMLDivElement>

const RequirementsRow: React.FC<ProgramInfoRowProps> = ({
  program,
  ...others
}) => {
  const parsedReqs = parseReqTree(program.req_tree)
  const totalRequired = parsedReqs.reduce(
    (sum, req) => sum + req.requiredCourseCount,
    0,
  )
  if (totalRequired === 0) return null

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

const ProgramCertificateBox: React.FC<{ program: V2Program }> = ({
  program,
}) => {
  const price = program.page.price
  if (!price) return null
  return (
    <CertificateBoxRoot>
      <InfoRowInner flexWrap="nowrap">
        <span>
          <UnderlinedLink
            href={PROGRAM_CERT_INFO_HREF}
            target="_blank"
            rel="noopener noreferrer"
            color="black"
          >
            <InfoLabel>Earn a certificate</InfoLabel>
          </UnderlinedLink>
          : {price}
        </span>
      </InfoRowInner>
      {program.page.financial_assistance_form_url ? (
        <UnderlinedLink
          color="black"
          href={mitxonlineUrl(program.page.financial_assistance_form_url)}
          target="_blank"
          rel="noopener noreferrer"
          style={{ minWidth: "fit-content" }}
        >
          Financial assistance available
        </UnderlinedLink>
      ) : null}
    </CertificateBoxRoot>
  )
}

type ProgramPriceRowProps = HTMLAttributes<HTMLDivElement> & {
  program: V2Program
}
const ProgramPriceRow: React.FC<ProgramPriceRowProps> = ({
  program,
  ...others
}) => {
  return (
    <InfoRow {...others}>
      <InfoRowIcon>
        <RiPriceTag3Line aria-hidden="true" />
      </InfoRowIcon>
      <InfoRowInner>
        <InfoLabelValue label="Price" value="Free to Learn" />
        <ProgramCertificateBox program={program} />
      </InfoRowInner>
    </InfoRow>
  )
}

const ProgramSummary: React.FC<{
  program: V2Program
  /**
   * Avoid using this. Ideally, ProgramSummary should be based on `program` data.
   */
  courses?: CourseWithCourseRunsSerializerV2[]
}> = ({ program, courses }) => {
  return (
    <Stack gap={{ xs: "24px", md: "32px" }}>
      <RequirementsRow
        program={program}
        data-testid={TestIds.RequirementsRow}
      />
      <ProgramDurationRow program={program} data-testid={TestIds.DurationRow} />
      <ProgramPaceRow courses={courses} data-testid={TestIds.PaceRow} />
      <ProgramPriceRow data-testid={TestIds.PriceRow} program={program} />
    </Stack>
  )
}

export { CourseSummary, ProgramSummary, UnderlinedLink, TestIds }
