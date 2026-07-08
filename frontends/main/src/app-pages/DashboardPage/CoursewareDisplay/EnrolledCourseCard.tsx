import React from "react"
import { SimpleMenu, Stack, styled } from "ol-components"
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
import { RiArrowUpCircleLine, RiAwardLine, RiMore2Line } from "@remixicon/react"
import { useReplaceBasketItem } from "@/common/mitxonline/useReplaceBasketItem"
import { isInPast, calendarDaysUntil, NoSSR } from "ol-utilities"
import { SiblingRunsAccordion } from "./SiblingRunsAccordion"
import { EnrollmentStatusIndicator } from "./EnrollmentStatusIndicator"
import { mitxUserQueries } from "api/mitxonline-hooks/user"
import { useQuery } from "@tanstack/react-query"
import { Button, ButtonLink } from "@mitodl/smoot-design"
import { coursePageView } from "@/common/urls"
import NiceModal from "@ebay/nice-modal-react"
import { EmailSettingsDialog, UnenrollDialog } from "./DashboardDialogs"
import { getReceiptMenuItem } from "./receiptMenuItem"
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

const EnrolledCardShell = styled.div(({ theme }) => ({
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  borderRadius: "8px",
  overflow: "hidden",
  backgroundColor: theme.custom.colors.white,
  [theme.breakpoints.down("md")]: {
    display: "none",
  },
  '&[data-layout="compact"]': {
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
  },
}))

const CardHeaderContent = styled.div({
  padding: "16px 16px 0 16px",
  display: "flex",
  gap: "8px",
  alignItems: "center",
})

const MobileAccordionWrapper = styled.div({
  width: "100%",
})

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
  const certStatus = certificateLink ? (
    <SubtitleLink href={certificateLink} layout={layout}>
      <RiAwardLine size="16px" />
      {isCompact ? "Certificate" : "View Certificate"}
    </SubtitleLink>
  ) : showUpgradeBanner ? (
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

  const hasMultipleRuns = (siblingEnrollments?.length ?? 0) > 0

  return (
    <>
      {hasMultipleRuns ? (
        <EnrolledCardShell
          data-testid="enrollment-card-desktop"
          data-layout={layout}
          className={className}
          as={Component}
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
          <SiblingRunsAccordion
            enrollment={enrollment}
            siblingEnrollments={siblingEnrollments ?? []}
          />
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
        {hasMultipleRuns && (
          <MobileAccordionWrapper>
            <SiblingRunsAccordion
              enrollment={enrollment}
              siblingEnrollments={siblingEnrollments ?? []}
            />
          </MobileAccordionWrapper>
        )}
      </CardRoot>
    </>
  )
}
