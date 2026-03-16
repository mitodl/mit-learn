import React from "react"
import {
  styled,
  Container,
  Breadcrumbs,
  Stack,
  BannerBackground,
  Grid2,
} from "ol-components"
import { LearningResource, PodcastEpisodeResource, ResourceTypeEnum } from "api"
import { RiMailLine } from "@remixicon/react"
import { HOME as HOME_URL } from "../../common/urls"
import RecentEpisodesPanel from "./RecentEpisodesPanel"
import PodcastSubscribePopover from "./PodcastSubscribePopover"
import { ResourceCard } from "@/page-components/ResourceCard/ResourceCard"
const DEFAULT_BACKGROUND_IMAGE_URL =
  "/images/backgrounds/background_podcast.png"
const DEFAULT_BACKGROUND_IMAGE_MOBILE_URL =
  "/images/backgrounds/background_podcast_mobile.png"

const StyledBannerBackground = styled(BannerBackground)(({ theme }) => ({
  position: "relative",
  overflow: "hidden",
  padding: "48px 0 64px 0",
  [theme.breakpoints.down("md")]: {
    padding: "40px 0 16px 0",
  },
  [theme.breakpoints.down("sm")]: {
    backgroundImage: `linear-gradient(rgba(0 0 0 / 50%), rgba(0 0 0 / 50%)), url('${DEFAULT_BACKGROUND_IMAGE_MOBILE_URL}')`,
    backgroundAttachment: "scroll",
    backgroundPosition: "center center",
    backgroundSize: "cover",
  },
}))

const SubscriptionButtonContainer = styled.div(({ theme }) => ({
  position: "relative",
  minHeight: "38px",
  display: "flex",
  marginTop: "32px",
  [theme.breakpoints.down("sm")]: {
    marginTop: "24px",
  },
}))

const BackgroundVector = styled("img")(({ theme }) => ({
  position: "absolute",
  top: 0,
  right: 0,
  width: 320,
  maxWidth: "45%",
  height: "auto",
  pointerEvents: "none",
  zIndex: 0,
  [theme.breakpoints.down("md")]: {
    width: 100,
    maxWidth: "55%",
  },
}))

const BannerForeground = styled.div({
  position: "relative",
  zIndex: 1,
})

const BackgroundCircles = styled("img")(({ theme }) => ({
  position: "absolute",
  bottom: 0,
  left: 0,
  width: 800,
  height: "auto",
  pointerEvents: "none",
  zIndex: 0,
  transform: "translate(-50%, 50%)",
  [theme.breakpoints.down("md")]: {
    width: 320,
  },
}))

const BannerTitle = styled("h1")(({ theme }) => ({
  color: theme.custom.colors.lightRed,
  ...theme.typography.h1,
  margin: 0,
  [theme.breakpoints.down("md")]: {
    ...theme.typography.h2,
  },
  [theme.breakpoints.down("sm")]: {
    ...theme.typography.h3,
    marginTop: "8px",
  },
}))

const BannerDescription = styled("p")(({ theme }) => ({
  color: theme.custom.colors.white,
  ...theme.typography.h3,
  margin: 0,
  [theme.breakpoints.down("md")]: {
    ...theme.typography.h2,
  },
  [theme.breakpoints.down("sm")]: {
    ...theme.typography.h5,
    marginTop: "8px",
  },
}))

const BannerContent = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  [theme.breakpoints.down("md")]: {
    flexDirection: "column",
  },
}))

const LeftGrid = styled(Grid2)({
  alignItems: "center",
  display: "flex",
})

const ContentContainer = styled(Container)(({ theme }) => ({
  [theme.breakpoints.down("md")]: {
    paddingLeft: "24px",
    paddingRight: "24px",
  },
}))

const LearningResourceCard = styled(ResourceCard)(({ theme }) => ({
  marginBottom: "32px",
  [theme.breakpoints.down("sm")]: {
    marginBottom: 0,
    gap: "16px",
  },
}))

const PodcastsSection = styled.div(({ theme }) => ({
  padding: "48px 0 64px",
  backgroundColor: theme.custom.colors.white,
  [theme.breakpoints.down("md")]: {
    padding: "32px 0 40px",
  },
  [theme.breakpoints.down("sm")]: {
    padding: "24px 0 40px",
  },
}))

const BelowMdOnly = styled.div(({ theme }) => ({
  [theme.breakpoints.up("md")]: {
    display: "none",
  },
}))

const AboveMdOnly = styled.div(({ theme }) => ({
  [theme.breakpoints.down("md")]: {
    display: "none",
  },
}))

const MobilePodcastList = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  padding: `0 ${theme.spacing(2)}`,
  [theme.breakpoints.down("sm")]: {
    gap: "16px",
  },
}))

const PodcastsGrid = styled.div(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "repeat(6, 1fr)",
  gap: "24px",
  [theme.breakpoints.down("lg")]: {
    gridTemplateColumns: "repeat(4, 1fr)",
  },
  [theme.breakpoints.down("md")]: {
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "16px",
  },
  [theme.breakpoints.down("sm")]: {
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: "12px",
  },
}))

interface PodcastPageTemplateProps {
  children?: React.ReactNode
  episodes: PodcastEpisodeResource[]
  podcasts: LearningResource[]
}

const PodcastPageTemplate: React.FC<PodcastPageTemplateProps> = ({
  episodes,
  podcasts,
}) => {
  return (
    <>
      <StyledBannerBackground
        backgroundUrl={DEFAULT_BACKGROUND_IMAGE_URL}
        backgroundDim={50}
      >
        <BackgroundVector src="/images/Vector.svg" alt="" aria-hidden="true" />
        <BackgroundCircles
          src="/images/circles.svg"
          alt=""
          aria-hidden="true"
        />
        <BannerForeground>
          <ContentContainer>
            <Breadcrumbs
              variant="dark"
              ancestors={[{ href: HOME_URL, label: "Home" }]}
              current="podcasts"
            />

            <BannerContent>
              <Grid2
                container
                spacing={{ xs: 2, sm: 2, md: 20 }}
                style={{ width: "100%" }}
              >
                <LeftGrid size={{ xs: 12, sm: 6, md: 7 }}>
                  <Stack>
                    <BannerTitle>MIT Podcasts</BannerTitle>

                    <BannerDescription>
                      for learners, thinkers, and innovators.
                    </BannerDescription>

                    <Stack
                      flexDirection="row"
                      alignItems="end"
                      sx={{
                        flexGrow: 0,
                        width: "100%",
                        flexShrink: 1,
                      }}
                    >
                      <SubscriptionButtonContainer>
                        <PodcastSubscribePopover
                          buttonLabel="Subscribe to new episodes"
                          buttonIcon={<RiMailLine size={20} />}
                        />
                      </SubscriptionButtonContainer>
                    </Stack>
                  </Stack>
                </LeftGrid>
                <Grid2
                  size={{ xs: 12, sm: 6, md: 5 }}
                  style={{ display: "flex", alignSelf: "center" }}
                >
                  <RecentEpisodesPanel episodes={episodes} />
                </Grid2>
              </Grid2>
            </BannerContent>
          </ContentContainer>
        </BannerForeground>
      </StyledBannerBackground>

      {podcasts.length > 0 ? (
        <PodcastsSection>
          <BelowMdOnly>
            <MobilePodcastList>
              {podcasts.map((resource) => (
                <LearningResourceCard
                  key={resource.id}
                  resource={resource}
                  footerLabel={
                    resource.resource_type === ResourceTypeEnum.Podcast
                      ? `${resource.podcast?.episode_count} Episodes`
                      : undefined
                  }
                  parentHeadingEl="h4"
                  list
                />
              ))}
            </MobilePodcastList>
          </BelowMdOnly>
          <AboveMdOnly>
            <Container>
              <PodcastsGrid>
                {podcasts.map((resource) => (
                  <LearningResourceCard
                    key={resource.id}
                    resource={resource}
                    footerLabel={
                      resource.resource_type === ResourceTypeEnum.Podcast
                        ? `${resource.podcast?.episode_count} Episodes`
                        : undefined
                    }
                    parentHeadingEl="h4"
                    size="small"
                  />
                ))}
              </PodcastsGrid>
            </Container>
          </AboveMdOnly>
        </PodcastsSection>
      ) : null}
    </>
  )
}

export default PodcastPageTemplate
