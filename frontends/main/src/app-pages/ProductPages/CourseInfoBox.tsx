import React, { HTMLAttributes, useState } from "react"
import { Alert, ButtonLink, styled, VisuallyHidden } from "@mitodl/smoot-design"
import { productQueries } from "api/mitxonline-hooks/products"
import { programsQueries } from "api/mitxonline-hooks/programs"
import { Skeleton, Stack, Typography } from "ol-components"
import {
  RiCalendarLine,
  RiComputerLine,
  RiPriceTag3Line,
  RiSparkling2Line,
  RiTimeLine,
} from "@remixicon/react"
import { formatDate, isInPast, LocalDate, NoSSR } from "ol-utilities"
import type {
  BaseProgram,
  CourseWithCourseRunsSerializerV2,
  CourseRunV2,
  V2ProgramDetail,
} from "@mitodl/mitxonline-api-axios/v2"
import { HeadingIds, parseReqTree } from "./util"
import {
  canPurchaseRun,
  formatPrice,
  getEnrollmentType,
  mitxonlineUrl,
  priceWithDiscount,
} from "@/common/mitxonline"
import { useQueries, useQuery } from "@tanstack/react-query"
import { programPageView } from "@/common/urls"
import CourseEnrollmentButton from "./CourseEnrollmentButton"
import {
  InfoRow,
  InfoRowIcon,
  InfoRowInner,
  InfoLabel,
  InfoLabelValue,
  UnderlinedLink,
  CertificateBoxRoot,
  GrayText,
  StrickenText,
  SummaryRows,
  LearnMoreDialog,
  SummaryCard,
  SummaryContent,
  EnrollArea,
  AskTimButton,
  PACE_DATA,
  getCourseRunPacing,
} from "./InfoBoxShared"

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

const CourseCertificateBox: React.FC<CourseInfoRowProps> = ({
  nextRun,
  course,
}) => {
  const canPurchase = nextRun ? canPurchaseRun(nextRun) : false
  const product = nextRun?.products[0]
  const hasFinancialAid = !!(
    course?.page.financial_assistance_form_url && product
  )
  const userFlexiblePrice = useQuery({
    ...productQueries.userFlexiblePriceDetail({ productId: product?.id ?? 0 }),
    enabled: canPurchase && hasFinancialAid,
  })
  const price =
    canPurchase && product
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
  const enrollmentType = getEnrollmentType(nextRun?.enrollment_modes)
  const product = nextRun?.products[0]
  const canPurchase = nextRun ? canPurchaseRun(nextRun) : false
  const hasFinancialAid = !!(
    course.page.financial_assistance_form_url && product
  )
  const userFlexiblePrice = useQuery({
    ...productQueries.userFlexiblePriceDetail({ productId: product?.id ?? 0 }),
    enabled: enrollmentType === "paid" && canPurchase && hasFinancialAid,
  })
  const price =
    enrollmentType === "paid" && product
      ? priceWithDiscount({ product, flexiblePrice: userFlexiblePrice.data })
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
                href={mitxonlineUrl(course.page.financial_assistance_form_url)}
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

const WideButtonLink = styled(ButtonLink)(({ theme }) => ({
  width: "100%",
  [theme.breakpoints.between("sm", "md")]: {
    width: "auto",
    marginLeft: "auto",
  },
}))

const BundleUpsellContainer = styled.div(({ theme }) => ({
  boxShadow: "inset 0px 16px 24px 0px rgba(0, 40, 150, 0.05)",
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  [theme.breakpoints.up("md")]: {
    borderTop: `1px solid ${theme.custom.colors.lightGray2}`,
    padding: "24px 32px",
  },
  // Tablet: standalone bordered card in the right column
  [theme.breakpoints.between("sm", "md")]: {
    border: `1px solid ${theme.custom.colors.lightGray2}`,
    borderRadius: "4px",
    padding: "24px",
  },
  [theme.breakpoints.down("sm")]: {
    borderTop: `1px solid ${theme.custom.colors.lightGray2}`,
    padding: "24px 16px",
  },
}))

const BundleUpsellItem = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: "24px",
  textAlign: "center",
  "& + &": {
    paddingTop: "16px",
    [theme.breakpoints.between("sm", "md")]: {
      borderTop: `1px solid ${theme.custom.colors.lightGray2}`,
      paddingTop: "24px",
    },
  },
  [theme.breakpoints.between("sm", "md")]: {
    flexDirection: "row",
    textAlign: "left",
    alignItems: "center",
  },
}))

const BundleUpsellText = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  [theme.breakpoints.between("sm", "md")]: {
    flex: 1,
  },
}))

const BundlePrice = styled.span(({ theme }) => ({
  ...theme.typography.h4,
  display: "block",
  color: theme.custom.colors.red,
}))

const BundleDiscount = styled.span(({ theme }) => ({
  ...theme.typography.body1,
  display: "block",
  color: theme.custom.colors.darkGray2,
}))

const BundlePriceRow = styled.div(({ theme }) => ({
  display: "flex",
  gap: "8px",
  alignItems: "center",
  justifyContent: "center",
  [theme.breakpoints.between("sm", "md")]: {
    justifyContent: "flex-start",
  },
}))

const BundleUpsellTitle = styled.span(({ theme }) => ({
  ...theme.typography.h5,
  display: "block",
  fontWeight: theme.typography.fontWeightRegular,
  "> strong": {
    fontWeight: theme.typography.fontWeightBold,
  },
}))

// For now we use a static 19% discount that is aligned with business rules
const BUNDLE_DISCOUNT_LABEL = "(19% off)"

type ProgramBundleUpsellItemProps =
  | { loading: true; program?: undefined }
  | { loading?: false; program: V2ProgramDetail }

const ProgramBundleUpsellItem: React.FC<ProgramBundleUpsellItemProps> = ({
  loading,
  program,
}) => {
  if (loading) {
    return (
      <BundleUpsellItem>
        <BundleUpsellText>
          <BundleUpsellTitle>
            <Skeleton width="80%" variant="text" sx={{ mx: "auto" }} />
            <Skeleton
              width="60%"
              variant="text"
              sx={(theme) => ({
                mx: "auto",
                [theme.breakpoints.between("sm", "md")]: {
                  display: "none",
                },
              })}
            />
          </BundleUpsellTitle>
          <BundlePriceRow>
            <BundlePrice>
              <Skeleton width={60} variant="text" />
            </BundlePrice>
            <BundleDiscount>
              <Skeleton width={50} variant="text" />
            </BundleDiscount>
          </BundlePriceRow>
        </BundleUpsellText>
        <Skeleton width="100%" variant="rectangular" height={40} />
      </BundleUpsellItem>
    )
  }

  const price = program.products[0]?.price
  const priceFormatted = price ? formatPrice(price, { avoidCents: true }) : null
  if (!priceFormatted) return null

  const parsedReqs = parseReqTree(program.req_tree)
  const totalCourses = parsedReqs.reduce(
    (sum, req) => sum + req.requiredCourseCount,
    0,
  )

  return (
    <BundleUpsellItem data-testid="program-bundle-upsell-item">
      <BundleUpsellText>
        <BundleUpsellTitle>
          Get all {totalCourses} <strong>{program.title}</strong> Courses +
          Certificate
        </BundleUpsellTitle>
        <BundlePriceRow>
          <BundlePrice>{priceFormatted}</BundlePrice>
          <BundleDiscount>{BUNDLE_DISCOUNT_LABEL}</BundleDiscount>
        </BundlePriceRow>
      </BundleUpsellText>
      <WideButtonLink
        variant="bordered"
        href={programPageView(program.readable_id)}
      >
        View Program
      </WideButtonLink>
    </BundleUpsellItem>
  )
}

// Fetches full program details individually. Ideally we'd use the listing
// endpoint, but it doesn't include product/price info. In practice only 1–2
// programs are fetched per course.
const ProgramBundleUpsell: React.FC<{ programs: BaseProgram[] }> = ({
  programs,
}) => {
  const programDetails = useQueries({
    queries: programs.map((p) =>
      programsQueries.programDetail({ id: String(p.id) }),
    ),
  })

  const anyLoading = programDetails.some((q) => q.isLoading)
  const pricedPrograms = programDetails
    .map((q) => q.data)
    .filter((d): d is V2ProgramDetail => !!d && !!d.products[0]?.price)

  if (!anyLoading && pricedPrograms.length === 0) return null

  return (
    <BundleUpsellContainer data-testid="program-bundle-upsell">
      {anyLoading ? (
        <>
          <Skeleton width={80} height={20} sx={{ mx: "auto" }} />
          {programs.map((p) => (
            <ProgramBundleUpsellItem key={p.id} loading />
          ))}
        </>
      ) : (
        <>
          <Typography variant="body2" sx={{ textAlign: "center" }}>
            Best value
          </Typography>
          {pricedPrograms.map((program) => (
            <ProgramBundleUpsellItem key={program.id} program={program} />
          ))}
        </>
      )}
    </BundleUpsellContainer>
  )
}

enum TestIds {
  DatesRow = "dates-row",
  PaceRow = "pace-row",
  DurationRow = "duration-row",
  PriceRow = "price-row",
  ProgramBundleUpsell = "program-bundle-upsell",
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

const CourseInfoBox: React.FC<{
  course: CourseWithCourseRunsSerializerV2
}> = ({ course }) => {
  const nextRunId = course.next_run_id
  const nextRun = course.courseruns.find((run) => run.id === nextRunId)
  return (
    <>
      <SummaryCard as="section" aria-labelledby={HeadingIds.Summary}>
        <VisuallyHidden>
          <h2 id={HeadingIds.Summary}>Course summary</h2>
        </VisuallyHidden>
        <SummaryContent>
          <SummaryRows>
            {!nextRun ? (
              <Alert severity="warning">
                No sessions of this course are currently open for enrollment.
                More sessions may be added in the future.
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
        </SummaryContent>
        <EnrollArea>
          <CourseEnrollmentButton course={course} />
        </EnrollArea>
        {course.programs?.length ? (
          <ProgramBundleUpsell programs={course.programs} />
        ) : null}
      </SummaryCard>
      <AskTimButton
        variant="bordered"
        size="large"
        startIcon={<RiSparkling2Line />}
        onClick={() => void 0}
        data-testid="ask-tim-button"
      >
        AskTIM about this course
      </AskTimButton>
    </>
  )
}

export default CourseInfoBox
export { ProgramBundleUpsell, TestIds }
