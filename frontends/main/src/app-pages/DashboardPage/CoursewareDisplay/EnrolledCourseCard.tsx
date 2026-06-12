import React from "react"
import { SimpleMenu, Stack } from "ol-components"
import {
  CardRoot,
  CourseStartCountdown,
  MenuButton,
  SubtitleLink,
  SubtitleLinkRoot,
  TitleHeading,
  TitleLink,
  TitleText,
} from "./CardShared"
import { EnrollmentStatus } from "./model/dashboardViewModel"
import { isVerifiedEnrollmentMode } from "@/common/mitxonline"
import { RiAddLine, RiAwardLine, RiMore2Line } from "@remixicon/react"
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
  } & React.HTMLAttributes<HTMLDivElement>
> = ({
  canUpgrade,
  certificateUpgradeDeadline,
  certificateUpgradePrice,
  productId,
  onError,
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
    <SubtitleLinkRoot {...others}>
      <SubtitleLink href="#" onClick={handleUpgradeClick}>
        <RiAddLine size="16px" />
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
  onUpgradeError?: (error: string) => void
  Component?: React.ElementType
  className?: string
}

export const EnrolledCourseCard = ({
  enrollment,
  layout = "default",
  onUpgradeError,
  Component,
  className,
}: EnrolledCourseCardProps) => {
  const course = enrollment.run.course
  const run = enrollment.run
  const isContractPageResource = Boolean(enrollment.b2b_contract_id)
  const mitxOnlineUser = useQuery(mitxUserQueries.me())
  const isStaff = mitxOnlineUser.data?.is_staff
  const title = run?.title || course.title
  const coursewareUrl = run?.courseware_url
  const certificateLink = enrollment?.certificate?.link
  const enrollmentMode = enrollment?.enrollment_mode
  const canUpgrade =
    !isVerifiedEnrollmentMode(enrollmentMode) &&
    (run?.is_upgradable ?? false) &&
    (enrollment?.run?.upgrade_product_is_active ?? false)
  const offerUpgrade = !enrollment?.b2b_contract_id
  const startDate = run?.start_date
  const hasStarted = startDate ? isInPast(startDate) : true
  const enrollmentStatus = enrollment?.certificate?.uuid
    ? EnrollmentStatus.Completed
    : EnrollmentStatus.Enrolled
  const titleSection = (
    <>
      {coursewareUrl ? (
        <TitleHeading>
          <TitleLink size="medium" color="black" href={coursewareUrl}>
            {title}
          </TitleLink>
        </TitleHeading>
      ) : (
        <TitleText>{title}</TitleText>
      )}
      {certificateLink ? (
        <SubtitleLink href={certificateLink}>
          <RiAwardLine size="16px" />
          View Certificate
        </SubtitleLink>
      ) : null}
      {!isVerifiedEnrollmentMode(enrollmentMode) && offerUpgrade ? (
        <UpgradeBanner
          data-testid="upgrade-root"
          canUpgrade={canUpgrade}
          certificateUpgradeDeadline={run?.upgrade_deadline}
          certificateUpgradePrice={run?.upgrade_product_price}
          productId={run?.upgrade_product_id}
          onError={() => {
            onUpgradeError?.(
              "There was a problem adding the certificate to your cart.",
            )
          }}
        />
      ) : null}
    </>
  )
  // Determine if button should be disabled
  // Staff can access courseware even before the course has started
  const courseHasEnded = run?.end_date ? isInPast(run.end_date) : false
  const isDisabled = Boolean(
    !coursewareUrl || // Enrolled but no action available
      (!!startDate && !hasStarted && !isStaff), // Enrolled but course hasn't started yet
  )
  const buttonText =
    enrollmentStatus === EnrollmentStatus.Completed || courseHasEnded
      ? "View"
      : "Continue"
  const buttonSection = (
    <>
      <EnrollmentStatusIndicator
        status={enrollmentStatus}
        showNotComplete={Boolean(isContractPageResource)}
      />
      {isDisabled ? (
        <Button
          size="small"
          variant="primary"
          disabled
          className={className}
          data-testid="courseware-button"
        >
          {buttonText}
        </Button>
      ) : (
        <ButtonLink
          size="small"
          variant="primary"
          href={coursewareUrl ?? ""}
          className={className}
          data-testid="courseware-button"
        >
          {buttonText}
        </ButtonLink>
      )}
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
  const startDateSection =
    startDate && !hasStarted ? (
      <CourseStartCountdown startDate={startDate} />
    ) : null

  return (
    <>
      <CardRoot
        screenSize="desktop"
        data-testid="enrollment-card-desktop"
        as={Component}
        className={className}
        layout={layout}
      >
        <Stack justifyContent="start" alignItems="stretch" gap="8px" flex={1}>
          {titleSection}
        </Stack>
        <Stack gap="8px">
          <Stack direction="row" gap="8px" alignItems="center">
            {buttonSection}
            {contextMenu}
          </Stack>
          {startDateSection}
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
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="end"
          width="100%"
        >
          {startDateSection}
          <Stack direction="row" gap="8px" alignItems="center">
            {buttonSection}
          </Stack>
        </Stack>
      </CardRoot>
    </>
  )
}
