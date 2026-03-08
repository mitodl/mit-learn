import React, { HTMLAttributes } from "react"
import { VisuallyHidden } from "@mitodl/smoot-design"
import {
  RiComputerLine,
  RiFileCopy2Line,
  RiPriceTag3Line,
  RiSparkling2Line,
  RiTimeLine,
} from "@remixicon/react"
import { pluralize } from "ol-utilities"
import type {
  CourseWithCourseRunsSerializerV2,
  V2ProgramDetail,
} from "@mitodl/mitxonline-api-axios/v2"
import { HeadingIds, parseReqTree } from "./util"
import {
  formatPrice,
  getEnrollmentType,
  mitxonlineUrl,
} from "@/common/mitxonline"
import ProgramEnrollmentButton from "./ProgramEnrollmentButton"
import {
  ResponsiveLink,
  UnderlinedLink,
  InfoRow,
  InfoRowIcon,
  InfoRowInner,
  InfoLabel,
  InfoLabelValue,
  CertificateBoxRoot,
  GrayText,
  SummaryRows,
  LearnMoreDialog,
  SummaryCard,
  SummaryContent,
  EnrollArea,
  AskTimButton,
  PACE_DATA,
  SELF_PACED,
  INSTRUCTOR_PACED,
  getCourseRunPacing,
} from "./InfoBoxShared"

type ProgramInfoRowProps = {
  program: V2ProgramDetail
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

const ProgramCertificateBox: React.FC<{ program: V2ProgramDetail }> = ({
  program,
}) => {
  const price = program.products[0]?.price
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
          : {formatPrice(price)}
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
  program: V2ProgramDetail
}
const ProgramPriceRow: React.FC<ProgramPriceRowProps> = ({
  program,
  ...others
}) => {
  const enrollmentType = getEnrollmentType(program.enrollment_modes)
  if (enrollmentType === "none") return null

  const paidPrice =
    enrollmentType === "paid" && program.products[0]?.price ? (
      <>
        {formatPrice(program.products[0].price)}{" "}
        <GrayText>(includes {program.certificate_type})</GrayText>
      </>
    ) : null

  return (
    <InfoRow {...others}>
      <InfoRowIcon>
        <RiPriceTag3Line aria-hidden="true" />
      </InfoRowIcon>
      <InfoRowInner>
        {enrollmentType === "paid" ? (
          <InfoLabelValue label="Price" value={paidPrice} />
        ) : (
          <InfoLabelValue label="Price" value="Free to Learn" />
        )}
        {enrollmentType === "both" ? (
          <ProgramCertificateBox program={program} />
        ) : null}
      </InfoRowInner>
    </InfoRow>
  )
}

enum TestIds {
  RequirementsRow = "requirements-row",
  DurationRow = "duration-row",
  PaceRow = "pace-row",
  PriceRow = "price-row",
}

const ProgramInfoBox: React.FC<{
  program: V2ProgramDetail
  /**
   * Avoid using this. Ideally, ProgramInfoBox should be based on `program` data.
   */
  courses?: CourseWithCourseRunsSerializerV2[]
}> = ({ program, courses }) => {
  return (
    <>
      <SummaryCard as="section" aria-labelledby={HeadingIds.Summary}>
        <VisuallyHidden>
          <h2 id={HeadingIds.Summary}>Program summary</h2>
        </VisuallyHidden>
        <SummaryContent>
          <SummaryRows>
            <RequirementsRow
              program={program}
              data-testid={TestIds.RequirementsRow}
            />
            <ProgramDurationRow
              program={program}
              data-testid={TestIds.DurationRow}
            />
            <ProgramPaceRow courses={courses} data-testid={TestIds.PaceRow} />
            <ProgramPriceRow data-testid={TestIds.PriceRow} program={program} />
          </SummaryRows>
        </SummaryContent>
        <EnrollArea>
          <ProgramEnrollmentButton program={program} />
        </EnrollArea>
      </SummaryCard>
      <AskTimButton
        variant="bordered"
        size="large"
        startIcon={<RiSparkling2Line />}
        onClick={() => void 0}
        data-testid="ask-tim-button"
      >
        AskTIM about this program
      </AskTimButton>
    </>
  )
}

export default ProgramInfoBox
export { TestIds }
