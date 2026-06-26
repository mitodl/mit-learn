import React from "react"
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  SimpleMenu,
  Stack,
  styled,
  Typography,
} from "ol-components"
import {
  CardRoot,
  CardTypeText,
  CoursewareActionColumn,
  CoursewareButton,
  CoursewareButtonLink,
  MenuButton,
  Separator,
  SubtitleLink,
  SubtitleLinkRoot,
  TitleHeading,
  TitleLink,
  TitleText,
  CourseDateSummary,
  UpgradedBanner,
} from "./CardShared"
import {
  EnrollmentStatus,
  DashboardType,
  getCertificateLink,
  getDashboardEnrollmentStatus,
} from "./model/dashboardViewModel"
import { getCourseDateText } from "./courseDateUtils"
import { isVerifiedEnrollmentMode } from "@/common/mitxonline"
import {
  RiArrowDownSLine,
  RiArrowRightSLine,
  RiArrowUpCircleLine,
  RiAwardLine,
  RiMore2Line,
  RiTimeLine,
  RiSubtractLine,
} from "@remixicon/react"
import { useReplaceBasketItem } from "@/common/mitxonline/useReplaceBasketItem"
import { isInPast, calendarDaysUntil, NoSSR, formatDate } from "ol-utilities"
import { EnrollmentStatusIndicator } from "./EnrollmentStatusIndicator"
import { mitxUserQueries } from "api/mitxonline-hooks/user"
import { useQuery } from "@tanstack/react-query"
import { Button, ButtonLink } from "@mitodl/smoot-design"
import { coursePageView } from "@/common/urls"
import NiceModal from "@ebay/nice-modal-react"
import { EmailSettingsDialog, UnenrollDialog } from "./DashboardDialogs"
import { getReceiptMenuItem } from "./receiptMenuItem"
import NextLink from "next/link"
import { CourseRunEnrollmentV3 } from "@mitodl/mitxonline-api-axios/v2"

const formatUpgradeTime = (daysFloat: number) => {
  if (daysFloat < 0) return ""
  const days = Math.floor(daysFloat)
  if (days > 1) {
    return ` · ${days} days remaining`
  } else if (days === 1) {
    return ` · ${days} day remaining`
  }
  return " · Less than a day remaining"
}

const UpgradeBanner: React.FC<
  {
    canUpgrade: boolean
    certificateUpgradeDeadline?: string | null
    certificateUpgradePrice?: string | null
    productId?: number | null
    onError?: (error: Error) => void
    layout?: "default" | "compact"
  } & React.HTMLAttributes<HTMLDivElement>
> = ({
  canUpgrade,
  certificateUpgradeDeadline,
  certificateUpgradePrice,
  productId,
  onError,
  layout = "default",
  ...others
}) => {
  const replaceBasketItem = useReplaceBasketItem()

  const handleUpgradeClick = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    if (!productId) return

    try {
      await replaceBasketItem.mutateAsync(productId)
    } catch (error) {
      onError?.(error as Error)
    }
  }

  if (!canUpgrade || !certificateUpgradePrice || !productId) {
    return null
  }

  // If deadline is provided, check it hasn't passed
  if (certificateUpgradeDeadline && isInPast(certificateUpgradeDeadline)) {
    return null
  }

  const formattedPrice = `$${certificateUpgradePrice}`
  const calendarDays = certificateUpgradeDeadline
    ? calendarDaysUntil(certificateUpgradeDeadline)
    : null

  return (
    <SubtitleLinkRoot layout={layout} {...others}>
      <SubtitleLink layout={layout} href="#" onClick={handleUpgradeClick}>
        <RiArrowUpCircleLine size="16px" />
        {`Upgrade for certificate - ${formattedPrice}`}
      </SubtitleLink>
      {calendarDays !== null && (
        <NoSSR>
          {/* This uses local time. */}
          {formatUpgradeTime(calendarDays)}
        </NoSSR>
      )}
    </SubtitleLinkRoot>
  )
}

const AdditionalRunsAccordion = styled(Accordion)(({ theme }) => ({
  boxShadow: "none",
  "&:before": { display: "none" },
  backgroundColor: theme.custom.colors.white,
}))

const CurrentRunIcon = styled.div(({ theme }) => ({
  width: "8px",
  height: "8px",
  backgroundColor: theme.custom.colors.green,
  flexShrink: 0,
}))

const UpcomingRunIcon = styled(RiTimeLine)(({ theme }) => ({
  width: "16px",
  height: "16px",
  borderRadius: "50%",
  color: theme.custom.colors.white,
  backgroundColor: theme.custom.colors.yellow,
  flexShrink: 0,
}))

const ExpiredRunIcon = styled(RiSubtractLine)(({ theme }) => ({
  width: "16px",
  height: "16px",
  borderRadius: "50%",
  border: `1px solid ${theme.custom.colors.silverGray}`,
  color: theme.custom.colors.silverGray,
  flexShrink: 0,
}))

const EnrolledCardShell = styled.div(({ theme }) => ({
  border: `1px solid ${theme.custom.colors.lightGray1}`,
  borderRadius: "8px",
  overflow: "hidden",
  backgroundColor: theme.custom.colors.white,
  [theme.breakpoints.down("md")]: {
    display: "none",
  },
}))

const CardHeaderContent = styled.div({
  padding: "16px 16px 0 16px",
  display: "flex",
  gap: "8px",
  alignItems: "center",
})

const RunsListBox = styled.div(({ theme }) => ({
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  borderRadius: "8px",
  overflow: "hidden",
  width: "100%",
}))

const RunRow = styled.div<{ isFirst: boolean }>(({ theme, isFirst }) => ({
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  gap: "4px",
  padding: "16px",
  borderTop: isFirst ? "none" : `1px solid ${theme.custom.colors.lightGray2}`,
}))

const ViewContentLink = styled(NextLink)(({ theme }) => ({
  ...theme.typography.body3,
  color: theme.custom.colors.mitRed,
  textDecoration: "none",
  "&:hover": {
    textDecoration: "underline",
  },
}))

const ExpandChevron = styled(RiArrowDownSLine)(({ theme }) => ({
  width: "16px",
  height: "16px",
  color: theme.custom.colors.silverGrayDark,
  flexShrink: 0,
}))

const ViewContentArrow = styled(RiArrowRightSLine)(({ theme }) => ({
  width: "16px",
  height: "16px",
  color: theme.custom.colors.red,
  flexShrink: 0,
}))

const CourseRunsCountText = styled.span(({ theme }) => ({
  ...theme.typography.body3,
  color: theme.custom.colors.red,
  textDecoration: "underline",
}))

const RunsAccordionDetails = styled(AccordionDetails)({
  padding: 0,
})

const RunsListWrapper = styled.div({
  padding: "0 16px 16px",
})

const formatRunDateRange = (
  startDate?: string | null,
  endDate?: string | null,
): string => {
  const parts: string[] = []
  if (startDate) parts.push(formatDate(startDate, "MMM D, YYYY"))
  if (endDate) parts.push(formatDate(endDate, "MMM D, YYYY"))
  return parts.join(" – ")
}

const getRunStatusLabel = (status: EnrollmentStatus): string => {
  if (status === EnrollmentStatus.Completed) return "Completed"
  if (status === EnrollmentStatus.Enrolled) return "In Progress"
  return ""
}

type EnrolledCourseCardProps = {
  enrollment: CourseRunEnrollmentV3
  siblingEnrollments?: CourseRunEnrollmentV3[]
  layout?: "default" | "compact"
  headingLevel?: "h2" | "h3" | "h4" | "h5" | "h6"
  onUpgradeError?: (error: string) => void
  Component?: React.ElementType
  className?: string
}

export const EnrolledCourseCard = ({
  enrollment,
  siblingEnrollments,
  layout = "default",
  headingLevel,
  onUpgradeError,
  Component,
  className,
}: EnrolledCourseCardProps) => {
  const course = enrollment.run.course
  const run = enrollment.run
  const isContractPageResource = Boolean(enrollment.b2b_contract_id)
  const mitxOnlineUser = useQuery(mitxUserQueries.me())
  const isStaff = mitxOnlineUser.data?.is_staff
  const isCompact = layout === "compact"
  const title = isCompact ? course.title : run?.title || course.title
  const coursewareUrl = run?.courseware_url
  const certificateLink = getCertificateLink(
    enrollment?.certificate?.link,
    "course",
  )
  const enrollmentMode = enrollment?.enrollment_mode
  const offerUpgrade = !enrollment?.b2b_contract_id
  const startDate = run?.start_date
  const hasStarted = startDate ? isInPast(startDate) : true
  const endDate = run?.end_date
  const hasEnded = endDate ? isInPast(endDate) : false
  const hasCourseDateText = getCourseDateText(startDate, endDate) !== null
  const courseDateText = (
    <CourseDateSummary startDate={startDate} endDate={endDate} />
  )
  const canUpgrade =
    offerUpgrade &&
    !isVerifiedEnrollmentMode(enrollmentMode) &&
    (run?.is_upgradable ?? false) &&
    (enrollment?.run?.upgrade_product_is_active ?? false) &&
    !hasEnded
  const showUpgradeBanner =
    canUpgrade &&
    !!run?.upgrade_product_price &&
    !!run?.upgrade_product_id &&
    !(run?.upgrade_deadline && isInPast(run.upgrade_deadline))
  const enrollmentStatus = getDashboardEnrollmentStatus({
    type: DashboardType.CourseRunEnrollment,
    data: enrollment,
  })
  const upgradedAndIncomplete =
    !isContractPageResource && isVerifiedEnrollmentMode(enrollmentMode)
  const certStatus = showUpgradeBanner ? (
    <UpgradeBanner
      data-testid="upgrade-root"
      canUpgrade={showUpgradeBanner}
      certificateUpgradeDeadline={run?.upgrade_deadline}
      certificateUpgradePrice={run?.upgrade_product_price}
      productId={run?.upgrade_product_id}
      layout={layout}
      onError={() => {
        onUpgradeError?.(
          "There was a problem adding the certificate to your cart.",
        )
      }}
    />
  ) : certificateLink ? (
    <SubtitleLink href={certificateLink} layout={layout}>
      <RiAwardLine size="16px" />
      {isCompact ? "Certificate" : "View Certificate"}
    </SubtitleLink>
  ) : upgradedAndIncomplete ? (
    <UpgradedBanner />
  ) : null

  const metaSegments = [
    hasCourseDateText ? courseDateText : null,
    certStatus,
  ].filter(Boolean)

  const endDateAndCertSection =
    metaSegments.length > 0 ? (
      <Stack direction="row" alignItems="center">
        {metaSegments.map((segment, i) => (
          <React.Fragment key={i}>
            {i > 0 && <Separator />}
            {segment}
          </React.Fragment>
        ))}
      </Stack>
    ) : null
  const titleSection = (
    <Stack gap="6px">
      {coursewareUrl ? (
        <TitleHeading as={headingLevel}>
          <TitleLink size="medium" color="black" href={coursewareUrl}>
            {title}
          </TitleLink>
        </TitleHeading>
      ) : (
        <TitleText as={headingLevel}>{title}</TitleText>
      )}
      {isCompact ? null : endDateAndCertSection}
    </Stack>
  )
  // Determine if button should be disabled
  // Staff can access courseware even before the course has started
  const courseHasEnded = run?.end_date ? isInPast(run.end_date) : false
  const isDisabled = Boolean(
    !coursewareUrl || // Enrolled but no action available
      (!!startDate && !hasStarted && !isStaff), // Enrolled but course hasn't started yet
  )
  const isCompleted =
    enrollmentStatus === EnrollmentStatus.Completed || courseHasEnded
  const buttonText = isCompleted ? "View" : "Continue"
  const compactVariant = isCompleted ? "text" : "primary"
  const ctaButton = isCompact ? (
    isDisabled ? (
      <CoursewareButton
        size="small"
        variant={compactVariant}
        disabled
        data-testid="courseware-button"
        aria-label={`${buttonText} course: ${title}`}
      >
        {buttonText}
      </CoursewareButton>
    ) : (
      <CoursewareButtonLink
        size="small"
        variant={compactVariant}
        href={coursewareUrl ?? ""}
        data-testid="courseware-button"
        aria-label={`${buttonText} course: ${title}`}
      >
        {buttonText}
      </CoursewareButtonLink>
    )
  ) : isDisabled ? (
    <Button
      size="small"
      variant="primary"
      disabled
      data-testid="courseware-button"
      aria-label={`${buttonText} course: ${title}`}
    >
      {buttonText}
    </Button>
  ) : (
    <ButtonLink
      size="small"
      variant="primary"
      href={coursewareUrl ?? ""}
      data-testid="courseware-button"
      aria-label={`${buttonText} course: ${title}`}
    >
      {buttonText}
    </ButtonLink>
  )
  const buttonSection = isCompact ? (
    <Stack direction="row" alignItems="center">
      {endDateAndCertSection}
      {endDateAndCertSection && <Separator />}
      <CoursewareActionColumn direction="row" justifyContent="center">
        {ctaButton}
      </CoursewareActionColumn>
    </Stack>
  ) : (
    <>
      <EnrollmentStatusIndicator
        status={enrollmentStatus}
        showNotComplete={Boolean(isContractPageResource)}
      />
      {ctaButton}
    </>
  )
  const menuItems = []
  const readableId = run?.course.readable_id
  const detailsUrl = readableId ? coursePageView(readableId) : undefined

  if (detailsUrl && !isContractPageResource) {
    menuItems.push({
      className: "dashboard-card-menu-item",
      key: "view-course-details",
      label: "View Course Details",
      href: detailsUrl,
    })
  }

  menuItems.push(
    {
      className: "dashboard-card-menu-item",
      key: "email-settings",
      label: "Email Settings",
      onClick: () => {
        NiceModal.show(EmailSettingsDialog, {
          title,
          enrollment,
        })
      },
    },
    {
      className: "dashboard-card-menu-item",
      key: "unenroll",
      label: "Unenroll",
      onClick: () => {
        NiceModal.show(UnenrollDialog, { title, enrollment })
      },
    },
  )

  const receiptMenuItem = getReceiptMenuItem(
    enrollment?.enrollment_mode,
    `/orders/receipt/by-run/${enrollment?.run.id}/`,
  )
  if (receiptMenuItem) menuItems.push(receiptMenuItem)

  const contextMenu = (
    <SimpleMenu
      items={menuItems}
      trigger={
        <MenuButton
          size="small"
          variant="text"
          aria-label="More options"
          status={enrollmentStatus}
          hidden={menuItems.length === 0}
        >
          <RiMore2Line />
        </MenuButton>
      }
    />
  )

  const [expanded, setExpanded] = React.useState(false)

  const handleAccordionChange = () => {
    setExpanded(!expanded)
  }

  const otherEnrollments = (siblingEnrollments ?? []).filter(
    (e) => e.id !== enrollment.id,
  )

  const hasMultipleRuns = otherEnrollments.length > 0

  return (
    <>
      {hasMultipleRuns ? (
        <EnrolledCardShell
          data-testid="enrollment-card-desktop"
          className={className}
        >
          <CardHeaderContent>
            <Stack justifyContent="start" alignItems="stretch" flex={1}>
              <CardTypeText>Course</CardTypeText>
              {titleSection}
            </Stack>
            <Stack direction="row" gap="8px" alignItems="center">
              {buttonSection}
              {contextMenu}
            </Stack>
          </CardHeaderContent>
          <AdditionalRunsAccordion
            expanded={expanded}
            disableGutters={true}
            onChange={handleAccordionChange}
          >
            <AccordionSummary expandIcon={<ExpandChevron />}>
              <Stack direction="row" alignItems="flex-end" gap="24px" flex={1}>
                <Stack
                  direction="row"
                  alignItems="center"
                  gap="4px"
                  flex={1}
                  minWidth={0}
                >
                  <CurrentRunIcon />
                  <Typography variant="body3" color="darkGray2" noWrap>
                    Current run:
                  </Typography>
                  <Typography variant="body3" color="silverGrayDark" noWrap>
                    {formatRunDateRange(run?.start_date, run?.end_date)}
                    {getRunStatusLabel(enrollmentStatus)
                      ? ` (${getRunStatusLabel(enrollmentStatus)})`
                      : ""}
                  </Typography>
                </Stack>
                <CourseRunsCountText>
                  Course runs ({(siblingEnrollments?.length ?? 0) + 1})
                </CourseRunsCountText>
              </Stack>
            </AccordionSummary>
            <RunsAccordionDetails>
              <RunsListWrapper>
                <RunsListBox>
                  {otherEnrollments.map((enrollment, i) => {
                    const startDate = enrollment.run?.start_date
                    const endDate = enrollment.run?.end_date
                    const isUpcoming = startDate && !isInPast(startDate)
                    const isExpired = endDate && isInPast(endDate)
                    const runLabel = isUpcoming
                      ? `Upcoming: ${formatRunDateRange(startDate, endDate)}`
                      : formatRunDateRange(startDate, endDate)
                    const runEnrollmentStatus = getDashboardEnrollmentStatus({
                      type: DashboardType.CourseRunEnrollment,
                      data: enrollment,
                    })
                    const coursewareUrl = enrollment.run?.courseware_url
                    return (
                      <RunRow key={enrollment.id} isFirst={i === 0}>
                        <Stack
                          direction="row"
                          gap="8px"
                          alignItems="center"
                          flex={1}
                          minWidth={0}
                        >
                          {isUpcoming ? (
                            <UpcomingRunIcon />
                          ) : isExpired ? (
                            <ExpiredRunIcon />
                          ) : (
                            <EnrollmentStatusIndicator
                              status={runEnrollmentStatus}
                              showNotComplete
                            />
                          )}
                          <Typography
                            variant="subtitle3"
                            color="darkGray2"
                            noWrap
                          >
                            {runLabel}
                          </Typography>
                        </Stack>
                        {coursewareUrl && (
                          <Stack
                            direction="row"
                            gap="4px"
                            alignItems="center"
                            flexShrink={0}
                          >
                            <ViewContentLink href={coursewareUrl}>
                              View content
                            </ViewContentLink>
                            <ViewContentArrow />
                          </Stack>
                        )}
                      </RunRow>
                    )
                  })}
                </RunsListBox>
              </RunsListWrapper>
            </RunsAccordionDetails>
          </AdditionalRunsAccordion>
        </EnrolledCardShell>
      ) : (
        <CardRoot
          screenSize="desktop"
          data-testid="enrollment-card-desktop"
          as={Component}
          className={className}
          layout={layout}
        >
          <Stack justifyContent="start" alignItems="stretch" flex={1}>
            <CardTypeText>Course</CardTypeText>
            {titleSection}
          </Stack>
          <Stack direction="row" gap="8px" alignItems="center">
            {buttonSection}
            {contextMenu}
          </Stack>
        </CardRoot>
      )}
      <CardRoot
        screenSize="mobile"
        data-testid="enrollment-card-mobile"
        as={Component}
        className={className}
        layout={layout}
      >
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="stretch"
          flex={1}
          width="100%"
        >
          <Stack direction="column" gap="8px" flex={1}>
            {titleSection}
          </Stack>
          {contextMenu}
        </Stack>
        <Stack
          direction="row"
          gap="8px"
          alignItems="center"
          justifyContent="flex-end"
          width="100%"
        >
          {buttonSection}
        </Stack>
      </CardRoot>
    </>
  )
}
