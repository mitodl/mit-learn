import React from "react"
import {
  styled,
  Stack,
  Link,
  Typography,
  SimpleMenu,
  SimpleMenuItem,
} from "ol-components"
import type { EnrollmentData } from "./types"
import { ActionButton, Button, ButtonLink } from "@mitodl/smoot-design"
import { RiArrowRightLine, RiAwardLine, RiMoreLine } from "@remixicon/react"
import { getTimeUntil, isInPast, NoSSR } from "ol-utilities"

const LinkStyled = styled(Link)(({ theme }) => ({
  ...theme.typography.subtitle2,
}))
const CourseButtonLink = styled(ButtonLink)({
  width: "142px",
})
const CourseButton = styled(Button)({
  width: "142px",
})

const CardRoot = styled.div(({ theme }) => ({
  borderStyle: "solid",
  borderColor: theme.custom.colors.lightGray2,
  borderRadius: "8px",
  backgroundColor: theme.custom.colors.white,
}))
const Left = styled.div({
  padding: "24px 0px 0px 24px",
  flex: 1,
})
const Right = styled.div({
  padding: "16px 16px 0px 16px",
  display: "flex",
  alignItems: "start",
  gap: "8px",
})
const Bottom = styled.div({
  padding: "0px 24px 0px 24px",
  margin: "16px 0", // 16top/bottom collapses if div empty
})

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
  padding: "12px",
  backgroundColor: "#FFF4F5",
  borderRadius: "4px",
  display: "flex",
  alignItems: "center",
  gap: "8px",
  color: theme.custom.colors.darkGray2,
  ...theme.typography.subtitle3,
}))
const UpgradeAlertText = styled.div(({ theme }) => ({
  ...theme.typography.subtitle3,
  color: theme.custom.colors.mitRed,
  display: "flex",
  alignItems: "center",
  gap: "4px",
}))
const UpgradeBanner: React.FC<{
  canUpgrade: boolean
  certificateUpgradeDeadline?: string | null
  certificateUpgradePrice?: string | null
}> = ({ canUpgrade, certificateUpgradeDeadline, certificateUpgradePrice }) => {
  if (!canUpgrade || !certificateUpgradeDeadline || !certificateUpgradePrice) {
    return null
  }
  const timeUntil = getTimeUntil(certificateUpgradeDeadline)
  if (!timeUntil) return null
  if (timeUntil.ms < 0) return null
  const formattedPrice = `$${certificateUpgradePrice}`
  return (
    <UpgradeRoot data-testid="upgrade-root">
      <UpgradeAlertText>
        <RiAwardLine size="16px" />
        Add a certificate for {formattedPrice}
      </UpgradeAlertText>
      <NoSSR>
        {/* This uses local time. */}
        {formatUpgradeTime(timeUntil.days)}
      </NoSSR>
    </UpgradeRoot>
  )
}

type StartInfo = {
  hasStarted: boolean | null
  countdownUi: React.ReactNode
}
const getStartInfo = (date?: string | null): StartInfo => {
  if (!date) return { hasStarted: null, countdownUi: null }
  const timeUntil = getTimeUntil(date)
  if (!timeUntil) return { hasStarted: null, countdownUi: null }
  if (timeUntil.ms < 0) return { hasStarted: true, countdownUi: null }
  const { isToday, isTomorrow, days } = timeUntil
  return {
    hasStarted: false,
    countdownUi: (
      <CourseStartCountdown days={days} today={isToday} tomorrow={isTomorrow} />
    ),
  }
}

const CourseStartCountdown: React.FC<{
  days: number
  tomorrow: boolean
  today: boolean
}> = ({ days, today, tomorrow }) => {
  let value
  if (today) {
    value = "Today"
  } else if (tomorrow) {
    value = "Tomorrow"
  } else {
    value = `${Math.floor(days)} days`
  }
  return (
    <Typography
      sx={(theme) => ({
        color: theme.custom.colors.darkGray2,
        alignSelf: "flex-end",
      })}
      variant="body3"
      component="span"
    >
      {today || tomorrow ? "Starts" : "Starts in "}
      <Typography variant="subtitle3" component="span">
        {value}
      </Typography>
    </Typography>
  )
}

const getCoursewareText = (endDate?: string | null) => {
  if (!endDate) return "Continue Course"
  if (isInPast(endDate)) {
    return "View Course"
  }
  return "Continue Course"
}

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
    certificateUpgradeDeadline,
    certificateUpgradePrice,
  } = enrollment
  const { hasStarted, countdownUi } = getStartInfo(startDate)
  return (
    <CardRoot data-testid="enrollment-card">
      <Stack direction="row">
        <Left>
          <LinkStyled size="medium" color="black" href={marketingUrl}>
            {title}
          </LinkStyled>
        </Left>
        <Right>
          <Stack gap="4px">
            {hasStarted ? (
              <CourseButtonLink
                size="small"
                variant="primary"
                endIcon={<RiArrowRightLine />}
                href={coursewareUrl}
              >
                {getCoursewareText(endDate)}
              </CourseButtonLink>
            ) : (
              <CourseButton
                size="small"
                variant="primary"
                endIcon={<RiArrowRightLine />}
                disabled
              >
                {getCoursewareText(endDate)}
              </CourseButton>
            )}
            <NoSSR>
              {/* This uses local time */}
              {countdownUi}
            </NoSSR>
          </Stack>
          <SimpleMenu
            items={getMenuItems()}
            trigger={
              <ActionButton
                size="small"
                variant="text"
                aria-label="More options"
              >
                <RiMoreLine />
              </ActionButton>
            }
          />
        </Right>
      </Stack>
      <Bottom>
        <UpgradeBanner
          canUpgrade={canUpgrade}
          certificateUpgradeDeadline={certificateUpgradeDeadline}
          certificateUpgradePrice={certificateUpgradePrice}
        />
      </Bottom>
    </CardRoot>
  )
}

export { EnrollmentCard }
