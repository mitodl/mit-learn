import React from "react"
import { programPageView, programView } from "@/common/urls"
import {
  DisplayModeEnum,
  V3UserProgramEnrollment,
} from "@mitodl/mitxonline-api-axios/v2"
import {
  CardRoot,
  CardTypeText,
  MenuButton,
  Separator,
  SubtitleLink,
  TitleHeading,
  TitleLink,
  TitleText,
  UpgradedBanner,
} from "./CardShared"
import { RiAwardLine, RiMore2Line } from "@remixicon/react"
import {
  isVerifiedEnrollmentMode,
  mitxonlineLegacyUrl,
} from "@/common/mitxonline"
import { getCertificateLink } from "./model/dashboardViewModel"
import { ButtonLink } from "@mitodl/smoot-design"
import NiceModal from "@ebay/nice-modal-react"
import { UnenrollProgramDialog } from "./DashboardDialogs"
import { getReceiptMenuItem } from "./receiptMenuItem"
import { SimpleMenu, Stack } from "ol-components"
import { EnrollmentStatus } from "./helpers"
import { ProgressBadge } from "./ProgressBadge"

type ProgramEnrollmentCardProps = {
  programEnrollment: V3UserProgramEnrollment
  Component?: React.ElementType
  className?: string
}

export const ProgramEnrollmentCard = ({
  programEnrollment,
  Component,
  className,
}: ProgramEnrollmentCardProps) => {
  const program = programEnrollment.program
  const programId = program.id
  const readableId = program.readable_id
  const titleHref = programView(program.id)
  const title = program.title
  const certificateLink = getCertificateLink(
    programEnrollment.certificate?.link,
    "program",
  )
  const enrollmentStatus = programEnrollment.certificate?.uuid
    ? EnrollmentStatus.Completed
    : EnrollmentStatus.Enrolled
  const upgradedAndIncomplete = isVerifiedEnrollmentMode(
    programEnrollment.enrollment_mode,
  )
  const displayMode = program.display_mode
  const titleSection = (
    <Stack gap="6px">
      {titleHref ? (
        <TitleHeading>
          <TitleLink size="medium" color="black" href={titleHref}>
            {title}
          </TitleLink>
        </TitleHeading>
      ) : (
        <TitleText>{title}</TitleText>
      )}
      {upgradedAndIncomplete ? <UpgradedBanner /> : null}
    </Stack>
  )
  const buttonSection = (
    <>
      {certificateLink && (
        <SubtitleLink href={certificateLink}>
          <RiAwardLine size="16px" />
          View Certificate
        </SubtitleLink>
      )}
      <ButtonLink
        size="small"
        variant="primary"
        href={programView(program.id)}
        aria-label={`View program: ${title}`}
      >
        View
      </ButtonLink>
    </>
  )
  const detailsUrl = programPageView({
    readable_id: readableId,
    display_mode: displayMode,
  })
  const menuItems = []
  if (detailsUrl) {
    menuItems.push({
      className: "dashboard-card-menu-item",
      key: "view-program-details",
      label: "View Program Details",
      href: detailsUrl,
    })
  }
  menuItems.push({
    className: "dashboard-card-menu-item",
    key: "program-record",
    label: "Program Record",
    href: mitxonlineLegacyUrl(`/records/${programId}/`),
  })
  if (
    program.display_mode !== DisplayModeEnum.Course &&
    !isVerifiedEnrollmentMode(programEnrollment.enrollment_mode)
  ) {
    menuItems.push({
      className: "dashboard-card-menu-item",
      key: "unenroll-program",
      label: "Unenroll",
      onClick: () => {
        NiceModal.show(UnenrollProgramDialog, {
          title,
          programId: program.id,
        })
      },
    })
  }
  const receiptMenuItem = getReceiptMenuItem(
    programEnrollment.enrollment_mode,
    `/orders/receipt/by-program/${program.id}/`,
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

  const progressBadgeSection = (
    <Stack direction="row" gap="4px" alignItems="center">
      <ProgressBadge enrollmentStatus={enrollmentStatus} />
      <Separator />
      <CardTypeText>Program</CardTypeText>
    </Stack>
  )

  return (
    <>
      <CardRoot
        screenSize="desktop"
        data-testid="enrollment-card-desktop"
        as={Component}
        className={className}
      >
        <Stack gap="4px" justifyContent="start" alignItems="stretch" flex={1}>
          {progressBadgeSection}
          {titleSection}
        </Stack>
        <Stack gap="8px">
          <Stack direction="row" gap="8px" alignItems="center">
            {buttonSection}
            {contextMenu}
          </Stack>
        </Stack>
      </CardRoot>

      <CardRoot
        screenSize="mobile"
        data-testid="enrollment-card-mobile"
        as={Component}
        className={className}
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
          <Stack direction="row" gap="8px" alignItems="center">
            {buttonSection}
          </Stack>
        </Stack>
      </CardRoot>
    </>
  )
}
