import React, { HTMLAttributes } from "react"
import { Alert, Button, styled, VisuallyHidden } from "@mitodl/smoot-design"
import { Dialog, Link, Skeleton, Stack, Typography } from "ol-components"
import {
  RiCalendarLine,
  RiComputerLine,
  RiPriceTag3Line,
  RiTimeLine,
  RiFileCopy2Line,
  RiAwardLine,
} from "@remixicon/react"
import { formatDate, NoSSR, pluralize } from "ol-utilities"
import {
  CourseWithCourseRunsSerializerV2,
  CourseRunV2,
  V2Program,
} from "@mitodl/mitxonline-api-axios/v2"
import { getElectiveSubtree, getRequiredSubtree } from "./util"
import { LearningResource } from "api"

const UnderlinedLink = styled(Link)({
  textDecoration: "underline",
})

const InfoRow = styled.div(({ theme }) => ({
  width: "100%",
  display: "flex",
  gap: "8px",
  alignItems: "baseline",
  color: theme.custom.colors.darkGray2,
  ...theme.typography.body2,
  [theme.breakpoints.down("sm")]: {
    ...theme.typography.body3,
  },
  svg: {
    width: "20px",
    height: "20px",
    transform: "translateY(25%)",
  },
}))

const InfoRowInner: React.FC<{ children?: React.ReactNode }> = ({
  children,
}) => (
  <Stack
    width="100%"
    direction="row"
    gap="16px"
    justifyContent="space-between"
    flexWrap="wrap"
  >
    {children}
  </Stack>
)

const InfoLabel = styled.span(({ theme }) => ({
  fontWeight: theme.typography.fontWeightBold,
}))
const InfoValue = styled.span({})
const InfoLabelValue: React.FC<{ label: string; value: React.ReactNode }> = ({
  label,
  value,
}) =>
  value ? (
    <span>
      <InfoLabel>{label}</InfoLabel>
      {": "}
      <InfoValue>{value}</InfoValue>
    </span>
  ) : null

const getStartDate = (
  course: CourseWithCourseRunsSerializerV2,
  run: CourseRunV2,
) => {
  if (course.availability === "anytime") return "Anytime"
  if (!run?.start_date) return null
  return (
    <NoSSR
      onSSR={
        <Skeleton
          variant="text"
          sx={{ display: "inline-block" }}
          width="80px"
        />
      }
    >
      {formatDate(run.start_date)}
    </NoSSR>
  )
}
const getEndDate = (run: CourseRunV2) => {
  if (!run.end_date) return null
  return (
    <NoSSR
      onSSR={
        <Skeleton
          variant="text"
          sx={{ display: "inline-block" }}
          width="80px"
        />
      }
    >
      {formatDate(run.end_date)}
    </NoSSR>
  )
}

const getCertificatePrice = (run: CourseRunV2) => {
  const product = run.products[0]
  if (!product || run.is_archived) return null
  const amount = product.price
  return Number(amount).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  })
}

const getUpgradeDeadline = (run: CourseRunV2) => {
  if (run.is_archived) return null
  return run.upgrade_deadline ? (
    <NoSSR
      onSSR={
        <Skeleton
          variant="text"
          sx={{ display: "inline-block" }}
          width="80px"
        />
      }
    >
      {formatDate(run.upgrade_deadline)}
    </NoSSR>
  ) : null
}

type CourseInfoRowProps = {
  course: CourseWithCourseRunsSerializerV2
  nextRun: CourseRunV2
} & HTMLAttributes<HTMLDivElement>
const DatesRow: React.FC<CourseInfoRowProps> = ({
  course,
  nextRun,
  ...others
}) => {
  const starts = getStartDate(course, nextRun)
  const ends = getEndDate(nextRun)
  if (!starts) return null
  return (
    <InfoRow {...others}>
      <RiCalendarLine aria-hidden="true" />
      <InfoRowInner>
        <InfoLabelValue label="Start" value={starts} />
        <InfoLabelValue label="End" value={ends} />
      </InfoRowInner>
    </InfoRow>
  )
}

type LearnMoreDialogProps = {
  buttonText: string
  href: string
  description: string
  title: string
}
const LearnMoreDialog: React.FC<LearnMoreDialogProps> = ({
  buttonText,
  href,
  description,
  title,
}) => {
  const [open, setOpen] = React.useState(false)
  return (
    <>
      <UnderlinedLink
        target="_blank"
        rel="noopener noreferrer"
        color="red"
        href=""
        role="button"
        onClick={(event) => {
          event.preventDefault()
          setOpen(true)
        }}
      >
        {buttonText}
      </UnderlinedLink>
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
          color="red"
        >
          Learn More
        </UnderlinedLink>
      </Dialog>
    </>
  )
}

const PACE_DATA = {
  instructor_paced: {
    label: "Instructor-Paced",
    description:
      "Guided learning. Follow a set schedule with specific due dates for assignments and exams. Course materials released on a schedule. Earn your certificate shortly after the course ends.",
    href: "https://mitxonline.zendesk.com/hc/en-us/articles/21994938130075-What-are-Instructor-Paced-courses-on-MITx-Online",
  },
  self_paced: {
    label: "Self-Paced",
    description:
      "Flexible learning. Enroll at any time and progress at your own speed. All course materials available immediately. Adaptable due dates and extended timelines. Earn your certificate as soon as you pass the course.",
    href: "https://mitxonline.zendesk.com/hc/en-us/articles/21994872904475-What-are-Self-Paced-courses-on-MITx-Online",
  },
}
const PaceRow: React.FC<CourseInfoRowProps> = ({ nextRun, ...others }) => {
  const isSelfPaced = nextRun.is_self_paced || nextRun.is_archived
  const pace = PACE_DATA[isSelfPaced ? "self_paced" : "instructor_paced"]

  return (
    <InfoRow {...others}>
      <RiComputerLine aria-hidden="true" />
      <InfoRowInner>
        <InfoLabelValue label="Course Format" value={pace.label} />{" "}
        <LearnMoreDialog
          buttonText="What's this?"
          href={pace.href}
          description={pace.description}
          title={`What are ${pace.label} courses?`}
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
      <RiTimeLine aria-hidden="true" />
      <InfoRowInner>
        <InfoLabelValue label="Estimated" value={display} />
      </InfoRowInner>
    </InfoRow>
  )
}

const CertificateBox: React.FC<CourseInfoRowProps> = ({ nextRun }) => {
  const certificatePrice = getCertificatePrice(nextRun)

  const certInfoLink = (
    <UnderlinedLink
      color="red"
      href="https://mitxonline.zendesk.com/hc/en-us/articles/28158506908699-What-is-the-Certificate-Track-What-are-Course-and-Program-Certificates"
      target="_blank"
      rel="noopener noreferrer"
    >
      Learn More
    </UnderlinedLink>
  )
  const upgradeDeadline = getUpgradeDeadline(nextRun)
  return (
    <Stack
      gap="8px"
      sx={(theme) => ({
        backgroundColor: theme.custom.colors.lightGray1,
        borderRadius: "8px",
        padding: "16px",
      })}
    >
      {certificatePrice ? (
        <>
          <InfoRowInner>
            <InfoLabelValue
              label="Certificate Track"
              value={certificatePrice}
            />
            {certInfoLink}
          </InfoRowInner>
          {upgradeDeadline ? (
            <Typography
              typography={{ xs: "body3", sm: "body2" }}
              sx={(theme) => ({ color: theme.custom.colors.red })}
            >
              Payment deadline: {upgradeDeadline}
            </Typography>
          ) : null}
        </>
      ) : (
        <InfoRowInner>
          <Typography typography={{ xs: "subtitle3", sm: "subtitle2" }}>
            Certificate deadline passed
          </Typography>
          {certInfoLink}
        </InfoRowInner>
      )}
    </Stack>
  )
}

const PriceRow: React.FC<CourseInfoRowProps> = ({
  course,
  nextRun,
  ...others
}) => {
  return (
    <InfoRow {...others}>
      <RiPriceTag3Line aria-hidden="true" />
      <Stack gap="8px">
        <InfoLabelValue label="Price" value="Free to Learn" />
        <CertificateBox course={course} nextRun={nextRun} />
      </Stack>
    </InfoRow>
  )
}

const SidebarSummaryRoot = styled.section(({ theme }) => ({
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  backgroundColor: theme.custom.colors.white,
  borderRadius: "0 0 4px 4px",
  boxShadow: "0 8px 20px 0 rgba(120, 147, 172, 0.10)",
  padding: "24px 32px",
  [theme.breakpoints.up("md")]: {
    position: "sticky",
    marginTop: "-24px",
    top: "calc(40px + 32px + 24px)",
    borderRadius: "4px",
  },
}))

const WideButton = styled(Button)({
  width: "100%",
})

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

const CourseSummary: React.FC<{
  course: CourseWithCourseRunsSerializerV2
}> = ({ course }) => {
  const nextRunId = course.next_run_id
  const nextRun = course.courseruns.find((run) => run.id === nextRunId)
  return (
    <SidebarSummaryRoot aria-labelledby="course-summary">
      <VisuallyHidden>
        <h2 id="course-summary">Course summary</h2>
      </VisuallyHidden>
      <Stack gap={{ xs: "24px", md: "32px" }}>
        {nextRun ? (
          <>
            <WideButton
              onClick={() => {
                alert("Enroll flow not yet implemented")
              }}
              variant="primary"
              size="large"
            >
              {nextRun.is_archived ? "Access Course Materials" : "Enroll Now"}
            </WideButton>
            {nextRun.is_archived ? <ArchivedAlert /> : null}
            <DatesRow
              course={course}
              nextRun={nextRun}
              data-testid={TestIds.DatesRow}
            />
            <PaceRow
              course={course}
              nextRun={nextRun}
              data-testid={TestIds.PaceRow}
            />
            <CourseDurationRow
              course={course}
              nextRun={nextRun}
              data-testid={TestIds.DurationRow}
            />
            <PriceRow
              course={course}
              nextRun={nextRun}
              data-testid={TestIds.PriceRow}
            />
          </>
        ) : (
          <Alert severity="warning">
            No sessions of this course are currently open for enrollment. More
            sessions may be added in the future.
          </Alert>
        )}
      </Stack>
    </SidebarSummaryRoot>
  )
}

const RequirementsRow: React.FC<ProgramInfoRowProps> = ({
  program,
  ...others
}) => {
  const requiredSubtree = getRequiredSubtree(program)
  const electiveSubtree = getElectiveSubtree(program)
  const requiredDisplay = requiredSubtree?.children?.length ? (
    <InfoRowInner>
      {`${requiredSubtree.children.length} Required ${pluralize(
        "Course",
        requiredSubtree.children.length,
      )}`}
      <span>Complete All</span>
    </InfoRowInner>
  ) : null
  const electiveDisplay = electiveSubtree?.children?.length ? (
    <InfoRowInner>
      {`${electiveSubtree.children.length} Elective ${pluralize(
        "Course",
        electiveSubtree.children.length,
      )}`}
      <span>
        Complete {electiveSubtree.data.operator_value} of{" "}
        {electiveSubtree.children.length}
      </span>
    </InfoRowInner>
  ) : null

  if (!requiredDisplay && !electiveDisplay) return null

  return (
    <InfoRow {...others}>
      <RiFileCopy2Line aria-hidden="true" />
      <Stack gap="8px" flex={1}>
        {requiredDisplay}
        {electiveDisplay}
      </Stack>
    </InfoRow>
  )
}

type ProgramInfoRowProps = {
  program: V2Program
} & HTMLAttributes<HTMLDivElement>
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
      <RiTimeLine aria-hidden="true" />
      <InfoRowInner>
        <InfoLabelValue label="Estimated" value={display} />
      </InfoRowInner>
    </InfoRow>
  )
}

const ProgramPaceRow: React.FC<
  { programResource: LearningResource | null } & HTMLAttributes<HTMLDivElement>
> = ({ programResource, ...others }) => {
  const paces = (programResource?.pace ?? []).sort((a, _b) =>
    // Put instructor-paced first if both exist
    a.code === "instructor_paced" ? -1 : 1,
  )
  if (!paces?.length) return null
  const pace = PACE_DATA[paces[0].code]
  return (
    <InfoRow {...others}>
      <RiComputerLine aria-hidden="true" />
      <InfoRowInner>
        <InfoLabelValue label="Program Format" value={pace.label} />{" "}
        <LearnMoreDialog
          buttonText="What's this?"
          href={pace.href}
          description={pace.description}
          title={`What are ${pace.label} courses?`}
        />
      </InfoRowInner>
    </InfoRow>
  )
}

const ProgramPriceRow = () => {
  return (
    <InfoRow>
      <RiPriceTag3Line aria-hidden="true" />
      <InfoRowInner>
        <InfoLabelValue label="Price" value="Free to Learn" />
      </InfoRowInner>
    </InfoRow>
  )
}

const ProgramCertificateRow: React.FC<ProgramInfoRowProps> = ({
  program,
  ...others
}) => {
  const min = program.min_price
  const max = program.max_price
  if (!min || !max) return null
  const range = min === max ? `$${min}` : `$${min}\u2013$${max}`
  return (
    <InfoRow {...others}>
      <RiAwardLine aria-hidden="true" />
      <Stack gap="8px" flex={1}>
        <InfoLabelValue label="Certificate Track" value={range} />
        <UnderlinedLink
          color="red"
          href="https://mitxonline.zendesk.com/hc/en-us/articles/28158506908699-What-is-the-Certificate-Track-What-are-Course-and-Program-Certificates"
          target="_blank"
          rel="noopener noreferrer"
        >
          What is the certificate track?
        </UnderlinedLink>
      </Stack>
    </InfoRow>
  )
}

const ProgramSummary: React.FC<{
  program: V2Program
  programResource: LearningResource | null
}> = ({ program, programResource }) => {
  return (
    <SidebarSummaryRoot aria-labelledby="program-summary">
      <VisuallyHidden>
        <h2 id="program-summary">Program summary</h2>
      </VisuallyHidden>
      <Stack gap={{ xs: "24px", md: "32px" }}>
        <RequirementsRow
          program={program}
          data-testid={TestIds.RequirementsRow}
        />
        <ProgramDurationRow
          program={program}
          data-testid={TestIds.DurationRow}
        />
        <ProgramPaceRow
          programResource={programResource ?? null}
          data-testid={TestIds.PaceRow}
        />
        <ProgramPriceRow />
        <ProgramCertificateRow program={program} />
      </Stack>
    </SidebarSummaryRoot>
  )
}

export { CourseSummary, ProgramSummary, UnderlinedLink, TestIds }
