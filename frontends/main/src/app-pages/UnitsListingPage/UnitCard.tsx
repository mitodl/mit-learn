import React from "react"
import type { OfferedByEnum } from "api"
import type { UnitChannel } from "api/v0"
import { Card, Skeleton, styled, theme, UnitLogo } from "ol-components"
import Link from "next/link"
import { usePostHog } from "posthog-js/react"
import { PostHogEvents } from "@/common/constants"

const CardStyled = styled(Card)({
  height: "100%",
})

const UnitCardContainer = styled.div({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  height: "100%",
  backgroundColor: "rgba(243, 244, 248, 0.50)",
})

const UnitCardContent = styled.div({
  display: "flex",
  flexDirection: "column",
  flexGrow: 1,
  width: "100%",
})

const LogoContainer = styled.div({
  padding: "40px 32px",
  backgroundColor: theme.custom.colors.white,
  [theme.breakpoints.down("md")]: {
    padding: "34px 0 14px",
    ".MuiSkeleton-root": {
      margin: "0 auto",
    },
  },
  img: {
    display: "block",
    [theme.breakpoints.down("md")]: {
      height: "40px",
      margin: "0 auto",
    },
    maxWidth: "calc(100% - 32px)",
  },
})

const CardBottom = styled.div({
  padding: "24px",
  borderTop: `1px solid ${theme.custom.colors.lightGray2}`,
  display: "flex",
  flexGrow: 1,
  flexDirection: "column",
  justifyContent: "space-between",
  gap: "24px",
  ...theme.typography.body1,
  [theme.breakpoints.down("md")]: {
    ...theme.typography.body2,
    padding: "16px",
    gap: "16px",
  },
})

const LoadingContent = styled.div({
  padding: "24px",
})

const CountsTextContainer = styled.div({
  display: "flex",
  gap: "10px",
})

interface UnitCardsProps {
  channels: UnitChannel[] | undefined
  courseCounts: Record<string, number>
  programCounts: Record<string, number>
}

interface UnitCardProps {
  channel: UnitChannel
  courseCount: number
  programCount: number
}

const UnitCard: React.FC<UnitCardProps> = (props) => {
  const posthog = usePostHog()
  const { channel, courseCount, programCount } = props
  const unit = channel.unit_detail.unit

  if (!channel.channel_url) return null
  const href = new URL(channel.channel_url).pathname

  return (
    <CardStyled forwardClicksToLink data-testid={`unit-card-${unit.code}`}>
      <Card.Content>
        <UnitCardContainer>
          <UnitCardContent>
            <LogoContainer>
              <Link
                href={href}
                onClick={() => {
                  if (process.env.NEXT_PUBLIC_POSTHOG_API_KEY) {
                    posthog.capture(PostHogEvents.ProviderLinkClicked, {
                      provider: unit,
                    })
                  }
                }}
                data-card-link
              >
                <UnitLogo unitCode={unit.code as OfferedByEnum} height={50} />
              </Link>
            </LogoContainer>
            <CardBottom>
              {channel?.configuration?.heading}
              <CountsTextContainer>
                <span data-testid={`course-count-${unit.code}`}>
                  {courseCount > 0 ? `Courses: ${courseCount}` : ""}
                </span>
                <span data-testid={`program-count-${unit.code}`}>
                  {programCount > 0 ? `Programs: ${programCount}` : ""}
                </span>
              </CountsTextContainer>
            </CardBottom>
          </UnitCardContent>
        </UnitCardContainer>
      </Card.Content>
    </CardStyled>
  )
}

export const UnitCardLoading = () => {
  return (
    <Card>
      <Card.Content>
        <UnitCardContainer>
          <UnitCardContent>
            <LogoContainer>
              <Skeleton variant="rectangular" width="60%" height={50} />
            </LogoContainer>
            <LoadingContent>
              <Skeleton variant="text" height={100} />
            </LoadingContent>
          </UnitCardContent>
        </UnitCardContainer>
      </Card.Content>
    </Card>
  )
}

export const UnitCards: React.FC<UnitCardsProps> = (props) => {
  const { channels, courseCounts, programCounts } = props
  return (
    <>
      {channels?.map((channel) => {
        const unit = channel.unit_detail.unit
        const courseCount = courseCounts[unit.code] || 0
        const programCount = programCounts[unit.code] || 0

        return unit.value_prop ? (
          <UnitCard
            key={unit.code}
            channel={channel}
            courseCount={courseCount}
            programCount={programCount}
          />
        ) : null
      })}
    </>
  )
}
