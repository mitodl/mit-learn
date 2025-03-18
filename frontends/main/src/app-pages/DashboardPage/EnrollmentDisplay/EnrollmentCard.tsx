import React from "react"
import {
  styled,
  Link,
  SimpleMenu,
  SimpleMenuItem,
  Chip,
  Stack,
} from "ol-components"
import Image from "next/image"
import type { EnrollmentData } from "./types"
import { ActionButton, Button, ButtonLink } from "@mitodl/smoot-design"
import { RiArrowRightLine, RiAwardLine, RiMore2Line } from "@remixicon/react"
import { calendarDaysUntil, isInPast, NoSSR } from "ol-utilities"

import CompleteCheck from "@/public/images/icons/complete-check.svg"

const CardRoot = styled.div(({ theme }) => ({
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  borderRadius: "8px",
  backgroundColor: theme.custom.colors.white,
  boxShadow: "0px 1px 6px 0px rgba(3, 21, 45, 0.05)",
  padding: "16px",
}))

const TitleLink = styled(Link)(({ theme }) => ({
  ...theme.typography.subtitle2,
  flex: 1,
  alignSelf: "center",
}))

const StyledChip = styled(Chip, {
  shouldForwardProp: (name) => name !== "noBorder",
})<{ noBorder?: boolean }>(({ theme, noBorder }) => [
  noBorder && {
    borderColor: "transparent",
  },
  {
    "&.MuiChip-clickable:hover, &.MuiChip-deletable:hover": {
      backgroundColor: `${theme.custom.colors.lightGray1}`,
      borderColor: `${theme.custom.colors.silverGrayLight}`,
      color: theme.custom.colors.darkGray2,
    },
  },
])

const MenuButton = styled(ActionButton)({
  marginLeft: "-8px",
})

const getCoursewareText = (endDate?: string | null) => {
  if (!endDate) return "Continue Course"
  if (isInPast(endDate)) {
    return "View Course"
  }
  return "Continue Course"
}

const CoursewareButton = styled(
  ({
    startDate,
    endDate,
    href,
    className,
  }: {
    startDate?: string | null
    endDate?: string | null
    href: string
    className?: string
  }) => {
    const children = getCoursewareText(endDate)
    const hasStarted = startDate && isInPast(startDate)
    return hasStarted ? (
      <ButtonLink
        size="small"
        variant="primary"
        endIcon={<RiArrowRightLine />}
        href={href}
        className={className}
      >
        {children}
      </ButtonLink>
    ) : (
      <Button
        size="small"
        variant="primary"
        endIcon={<RiArrowRightLine />}
        disabled
        className={className}
      >
        {children}
      </Button>
    )
  },
)({ width: "142px" })

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

const UpgradeRoot = styled.div(({ theme }) => ({
  borderRadius: "4px",
  display: "flex",
  alignItems: "center",
  gap: "8px",
  flex: 1,
  color: theme.custom.colors.darkGray2,
  ...theme.typography.subtitle3,
}))
const UpgradeLink = styled.a(({ theme }) => ({
  ...theme.typography.subtitle3,
  color: theme.custom.colors.mitRed,
  display: "flex",
  alignItems: "center",
  gap: "4px",
  ":hover": {
    textDecoration: "underline",
  },
}))
const UpgradeBanner: React.FC<
  {
    canUpgrade: boolean
    certificateUpgradeDeadline?: string | null
    certificateUpgradePrice?: string | null
  } & React.HTMLAttributes<HTMLDivElement>
> = ({
  canUpgrade,
  certificateUpgradeDeadline,
  certificateUpgradePrice,
  ...others
}) => {
  if (!canUpgrade || !certificateUpgradeDeadline || !certificateUpgradePrice) {
    return null
  }
  if (isInPast(certificateUpgradeDeadline)) return null
  const calendarDays = calendarDaysUntil(certificateUpgradeDeadline)
  if (calendarDays === null) return null
  const formattedPrice = `$${certificateUpgradePrice}`
  return (
    <UpgradeRoot {...others}>
      <UpgradeLink href="#">
        <RiAwardLine size="16px" />
        Add a certificate for {formattedPrice}
      </UpgradeLink>
      <NoSSR>
        {/* This uses local time. */}
        {formatUpgradeTime(calendarDays)}
      </NoSSR>
    </UpgradeRoot>
  )
}

const CountdownRoot = styled.div({
  width: "142px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  marginRight: "40px",
})
const CourseStartCountdown: React.FC<{
  startDate: string
  className?: string
}> = ({ startDate, className }) => {
  const calendarDays = calendarDaysUntil(startDate)

  let value
  if (calendarDays === null || calendarDays < 0) return null
  if (calendarDays === 0) {
    value = "Starts Today"
  } else if (calendarDays === 1) {
    value = "Starts Tomorrow"
  } else {
    value = `Starts in ${calendarDays} days`
  }
  return (
    <CountdownRoot>
      <StyledChip
        noBorder
        className={className}
        onClick={console.log}
        variant="outlined"
        label={value}
      />
    </CountdownRoot>
  )
}

const Completed = styled(Image)({
  width: "16px",
  height: "16px",
})

const getMenuItems = (): SimpleMenuItem[] => [
  {
    key: "placeholder1",
    label: "Placeholder 1",
    onClick: () => {},
  },
  {
    key: "placeholder2",
    label: "Placeholder 2",
    onClick: () => {},
  },
  {
    key: "placeholder3",
    label: "Placeholder 3",
    onClick: () => {},
  },
]

type EnrollmentCardProps = {
  enrollment: EnrollmentData
}
const EnrollmentCard: React.FC<EnrollmentCardProps> = ({ enrollment }) => {
  const {
    title,
    marketingUrl,
    coursewareUrl,
    startDate,
    endDate,
    canUpgrade,
    hasUserCompleted,
    certificateUpgradeDeadline,
    certificateUpgradePrice,
  } = enrollment
  return (
    <CardRoot data-testid="enrollment-card">
      <Stack
        direction="row"
        gap="16px"
        sx={{ marginBottom: "8px", alignItems: "start" }}
      >
        <TitleLink size="medium" color="black" href={marketingUrl}>
          {title}
        </TitleLink>
        <Stack direction="row" gap="16px" alignItems="center">
          {hasUserCompleted ? (
            <Completed src={CompleteCheck} alt="Completed" />
          ) : null}
          <CoursewareButton
            startDate={startDate}
            href={coursewareUrl}
            endDate={endDate}
          />
          <SimpleMenu
            items={getMenuItems()}
            trigger={
              <MenuButton size="small" variant="text" aria-label="More options">
                <RiMore2Line />
              </MenuButton>
            }
          />
        </Stack>
      </Stack>
      <Stack direction="row" gap="16px" justifyContent="flex-end">
        <UpgradeBanner
          data-testid="upgrade-root"
          canUpgrade={canUpgrade}
          certificateUpgradeDeadline={certificateUpgradeDeadline}
          certificateUpgradePrice={certificateUpgradePrice}
        />
        {startDate ? <CourseStartCountdown startDate={startDate} /> : null}
      </Stack>
    </CardRoot>
  )
}

export { EnrollmentCard }
