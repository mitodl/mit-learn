import React from "react"
import Link from "next/link"
import {
  Container,
  styled,
  theme,
  Typography,
  TypographyProps,
} from "ol-components"
import { ButtonLink } from "@mitodl/smoot-design"
import { useLearningResourceTopics } from "api/hooks/learningResources"
import { RiArrowRightLine } from "@remixicon/react"
import RootTopicIcon from "@/components/RootTopicIcon/RootTopicIcon"
import { usePostHog } from "posthog-js/react"
import { PostHogEvents } from "@/common/constants"

const Section = styled.section`
  background: #fff url("/images/backgrounds/open-bg-texture-with-gradient.svg")
    no-repeat center left;
  background-size: 135% auto;
  padding: 80px 0;
  ${theme.breakpoints.down("md")} {
    padding: 40px 0;
  }
  ${theme.breakpoints.down("sm")} {
    padding: 32px 0;
  }
`

const Title = styled(Typography)<Pick<TypographyProps, "component">>`
  text-align: center;
`

const Topics = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 16px 24px;
  margin: 40px 0;

  ${theme.breakpoints.down("md")} {
    gap: 5px;
    margin: 24px 0;
  }
`

const TopicBox = styled(Link)`
  flex: 0 1 calc(100% * (1 / 3) - 16px);
  padding: 24px;
  ${theme.breakpoints.down("md")} {
    flex: 0 1 100%;
    padding: 18px 15px;
  }

  border-radius: 5px;
  border: 1px solid ${theme.custom.colors.lightGray2};
  background: ${theme.custom.colors.white};
  overflow: hidden;
  display: flex;

  svg:last-child {
    color: ${theme.custom.colors.white};
    flex: 0 0 20px;
    margin-top: auto;
    margin-bottom: auto;
    margin-left: 8px;
  }

  :hover {
    color: ${theme.custom.colors.mitRed};
    border-color: ${theme.custom.colors.silverGrayLight};

    svg:last-child {
      color: ${theme.custom.colors.black};
      display: block;
    }
  }
`

const TopicBoxContent = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  width: 100%;

  svg {
    flex: 0 0 22px;
  }

  ${{
    ...theme.typography.subtitle1,
    [theme.breakpoints.down("md")]: theme.typography.subtitle2,
  }}
`

const TopicBoxName = styled.p`
  flex-grow: 1;
  margin: 0;
`

const SeeAllButton = styled(ButtonLink)`
  margin: 0 auto;
  box-sizing: content-box;
  display: flex;
  width: 152px;
`

const BrowseTopicsSection: React.FC = () => {
  const posthog = usePostHog()
  const { data: topics } = useLearningResourceTopics({ is_toplevel: true })

  return (
    <Section>
      <Container>
        <Title component="h2" variant="h2">
          Browse by Topic
        </Title>
        <Topics>
          {topics?.results.map(
            ({ id, name, channel_url: channelUrl, icon }) => {
              return (
                <TopicBox
                  key={id}
                  href={channelUrl ? new URL(channelUrl!).pathname : ""}
                  onClick={() => {
                    if (process.env.NEXT_PUBLIC_POSTHOG_API_KEY) {
                      posthog.capture(PostHogEvents.HomeTopicClicked, {
                        topic: name,
                      })
                    }
                  }}
                >
                  <TopicBoxContent>
                    <RootTopicIcon icon={icon} />
                    <TopicBoxName>{name}</TopicBoxName>
                    <RiArrowRightLine />
                  </TopicBoxContent>
                </TopicBox>
              )
            },
          )}
        </Topics>
        <SeeAllButton
          href="/topics/"
          onClick={() => {
            if (process.env.NEXT_PUBLIC_POSTHOG_API_KEY) {
              posthog.capture(PostHogEvents.HomeSeeAllTopicsClicked)
            }
          }}
          size="large"
          responsive
        >
          See all
        </SeeAllButton>
      </Container>
    </Section>
  )
}

export default BrowseTopicsSection
