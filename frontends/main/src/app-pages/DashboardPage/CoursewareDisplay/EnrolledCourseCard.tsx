import React from "react"
import { SimpleMenu, Stack } from "ol-components"
import {
  CardRoot,
  CardTypeText,
  CoursewareActionColumn,
  CoursewareButton,
  CoursewareButtonLink,
  HorizontalSeparator,
  MenuButton,
  Separator,
  SubtitleLink,
  SubtitleLinkRoot,
  TitleHeading,
  TitleLink,
  TitleText,
  CourseDateSummary,
} from "./CardShared"
import {
  EnrollmentStatus,
  DashboardType,
  getCertificateLink,
  getDashboardEnrollmentStatus,
} from "./model/dashboardViewModel"
import { isVerifiedEnrollmentMode } from "@/common/mitxonline"
import { RiAwardLine, RiMore2Line } from "@remixicon/react"
import { useReplaceBasketItem } from "@/common/mitxonline/useReplaceBasketItem"
import { isInPast, calendarDaysUntil, NoSSR } from "ol-utilities"
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
    return `${days} days remaining`
  } else if (days === 1) {
    return `${days} day remaining`
  }
  return "Less than a day remaining"
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
        <RiAwardLine size="16px" />
        {`Add a certificate for ${formattedPrice}`}
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

type EnrolledCourseCardProps = {
  enrollment: CourseRunEnrollmentV3
  layout?: "default" | "compact"
  headingLevel?: "h2" | "h3" | "h4" | "h5" | "h6"
  onUpgradeError?: (error: string) => void
  Component?: React.ElementType
  className?: string
}

export const EnrolledCourseCard = ({
  enrollment,
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
  const daysUntilEnd = endDate ? calendarDaysUntil(endDate) : null
  const hasEnded = endDate ? isInPast(endDate) : false
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
  const endDateAndCertSection = (
    <Stack direction="row" alignItems="center">
      {courseDateText}
      {courseDateText !== null && (showUpgradeBanner || !!certificateLink) ? (
        <Separator />
      ) : null}
      {showUpgradeBanner ? (
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
      ) : null}
      {certificateLink ? (
        <SubtitleLink href={certificateLink} layout={layout}>
          <RiAwardLine size="16px" />
          {isCompact ? "Certificate" : "View Certificate"}
        </SubtitleLink>
      ) : null}
    </Stack>
  )
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
      >
        {buttonText}
      </CoursewareButton>
    ) : (
      <CoursewareButtonLink
        size="small"
        variant={compactVariant}
        href={coursewareUrl ?? ""}
        data-testid="courseware-button"
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
    >
      {buttonText}
    </Button>
  ) : (
    <ButtonLink
      size="small"
      variant="primary"
      href={coursewareUrl ?? ""}
      data-testid="courseware-button"
    >
      {buttonText}
    </ButtonLink>
  )
  const buttonSection = isCompact ? (
    <Stack direction="row" gap="8px" alignItems="center">
      {endDateAndCertSection}
      {daysUntilEnd !== null || showUpgradeBanner || !!certificateLink ? (
        <HorizontalSeparator />
      ) : null}
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

  return (
    <>
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
        <Stack direction="row" gap="8px" alignItems="center">
          {buttonSection}
        </Stack>
      </CardRoot>
    </>
  )
}
