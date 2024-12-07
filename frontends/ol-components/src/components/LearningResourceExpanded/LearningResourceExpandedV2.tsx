import React, { useCallback, useRef, useState } from "react"
import styled from "@emotion/styled"
import Skeleton from "@mui/material/Skeleton"
import Typography from "@mui/material/Typography"
import { default as NextImage } from "next/image"
import { ActionButton, ButtonLink } from "../Button/Button"
import type { LearningResource } from "api"
import { ResourceTypeEnum, PlatformEnum } from "api"
import { DEFAULT_RESOURCE_IMG, getReadableResourceType } from "ol-utilities"
import {
  RiBookmarkLine,
  RiCloseLargeLine,
  RiExternalLinkLine,
  RiMenuAddLine,
} from "@remixicon/react"
import type { ImageConfig } from "../../constants/imgConfigs"
import { theme } from "../ThemeProvider/ThemeProvider"
import { PlatformLogo, PLATFORM_LOGOS } from "../Logo/Logo"
import InfoSectionV2 from "./InfoSectionV2"
import type { User } from "api/hooks/user"
import { LearningResourceCardProps } from "../LearningResourceCard/LearningResourceCard"
import { CardActionButton } from "../LearningResourceCard/LearningResourceListCard"
import VideoFrame from "./VideoFrame"
import { Link } from "../Link/Link"

const DRAWER_WIDTH = "900px"

const OuterContainer = styled.div({
  display: "flex",
  flexDirection: "column",
  flexGrow: 1,
  width: "100%",
  overflowX: "hidden",
})

const Container = styled.div({
  display: "flex",
  flexDirection: "column",
  padding: "0 32px 24px",
  width: DRAWER_WIDTH,
  [theme.breakpoints.down("md")]: {
    width: "auto",
    padding: "0 16px 24px",
  },
})

const TitleSectionContainer = styled.div({
  display: "flex",
  position: "sticky",
  justifyContent: "space-between",
  top: "0",
  padding: "24px 32px",
  zIndex: 1,
  backgroundColor: theme.custom.colors.white,
  [theme.breakpoints.down("md")]: {
    padding: "24px 16px",
  },
})

const ContentContainer = styled.div({
  display: "flex",
  alignItems: "flex-start",
  gap: "32px",
  alignSelf: "stretch",
  [theme.breakpoints.down("md")]: {
    alignItems: "center",
    flexDirection: "column-reverse",
    gap: "16px",
  },
})

const LeftContainer = styled.div({
  display: "flex",
  flexDirection: "column",
  flexGrow: 1,
  alignItems: "flex-start",
  gap: "24px",
  maxWidth: "100%",
})

const RightContainer = styled.div({
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "flex-start",
  gap: "24px",
  [theme.breakpoints.down("md")]: {
    width: "100%",
    alignItems: "center",
  },
})

const ImageContainer = styled.div({
  width: "100%",
})

const Image = styled(NextImage)<{ aspect: number }>`
  position: relative !important;
  border-radius: 8px;
  width: 100%;
  aspect-ratio: ${({ aspect }) => aspect};
  object-fit: cover;
`

const SkeletonImage = styled(Skeleton)<{ aspect: number }>((aspect) => ({
  borderRadius: "8px",
  paddingBottom: `${100 / aspect.aspect}%`,
}))

const CallToAction = styled.div({
  display: "flex",
  width: "350px",
  padding: "16px",
  flexDirection: "column",
  alignItems: "center",
  gap: "10px",
  borderRadius: "8px",
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  boxShadow: "0px 2px 10px 0px rgba(37, 38, 43, 0.10)",
  [theme.breakpoints.down("md")]: {
    width: "100%",
    padding: "0",
    border: "none",
    boxShadow: "none",
  },
})

const PlatformContainer = styled.div({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "16px",
  alignSelf: "stretch",
})

const StyledLink = styled(ButtonLink)({
  textAlign: "center",
  width: "100%",
  [theme.breakpoints.down("sm")]: {
    marginTop: "10px",
    marginBottom: "10px",
  },
})

const Platform = styled.div({
  display: "flex",
  justifyContent: "flex-end",
  alignItems: "center",
  gap: "16px",
})

const DescriptionContainer = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  width: "100%",
})

const Description = styled.p({
  ...theme.typography.body2,
  color: theme.custom.colors.black,
  margin: 0,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  "p:first-child": {
    marginTop: 0,
  },
  "p:last-child": {
    marginBottom: 0,
  },
})

const DescriptionCollapsed = styled(Description)({
  display: "-webkit-box",
  overflow: "hidden",
  height: `calc(${theme.typography.body2.lineHeight} * 5)`,
  "@supports (-webkit-line-clamp: 5)": {
    WebkitLineClamp: 5,
    WebkitBoxOrient: "vertical",
  },
})

const DescriptionExpanded = styled(Description)({
  display: "block",
})

const StyledPlatformLogo = styled(PlatformLogo)({
  height: "26px",
  maxWidth: "180px",
})

const OnPlatform = styled.span({
  ...theme.typography.body2,
  color: theme.custom.colors.black,
})

const ListButtonContainer = styled.div({
  display: "flex",
  gap: "8px",
  flexGrow: 1,
  justifyContent: "flex-end",
})

const CarouselContainer = styled.div({
  display: "flex",
  flexDirection: "column",
  flexGrow: 1,
  alignItems: "flex-start",
  width: DRAWER_WIDTH,
  padding: "32px",
  gap: "32px",
  borderTop: `1px solid ${theme.custom.colors.lightGray2}`,
  background: theme.custom.colors.lightGray1,
  div: {
    maxWidth: "100%",
  },
  [theme.breakpoints.down("md")]: {
    width: "100vw",
    padding: "16px 0 16px 16px",
  },
})

type LearningResourceExpandedV2Props = {
  resource?: LearningResource
  user?: User
  imgConfig: ImageConfig
  carousels?: React.ReactNode[]
  inLearningPath?: boolean
  inUserList?: boolean
  onAddToLearningPathClick?: LearningResourceCardProps["onAddToLearningPathClick"]
  onAddToUserListClick?: LearningResourceCardProps["onAddToUserListClick"]
  closeDrawer?: () => void
}

const CloseButton = styled(ActionButton)(({ theme }) => ({
  "&&&": {
    flexShrink: 0,
    backgroundColor: theme.custom.colors.lightGray2,
    color: theme.custom.colors.black,
    ["&:hover"]: {
      backgroundColor: theme.custom.colors.red,
      color: theme.custom.colors.white,
    },
  },
}))

const CloseIcon = styled(RiCloseLargeLine)`
  &&& {
    width: 18px;
    height: 18px;
  }
`

const TitleSection: React.FC<{
  resource?: LearningResource
  closeDrawer: () => void
}> = ({ resource, closeDrawer }) => {
  const closeButton = (
    <CloseButton
      variant="text"
      size="medium"
      onClick={() => closeDrawer()}
      aria-label="Close"
    >
      <CloseIcon />
    </CloseButton>
  )
  if (resource) {
    return (
      <TitleSectionContainer>
        <div>
          <Typography
            variant="subtitle2"
            color={theme.custom.colors.silverGrayDark}
          >
            {getReadableResourceType(resource?.resource_type)}
          </Typography>
          <Typography variant="h4" color={theme.custom.colors.darkGray2}>
            {resource?.title}
          </Typography>
        </div>
        {closeButton}
      </TitleSectionContainer>
    )
  } else {
    return (
      <TitleSectionContainer>
        <Skeleton variant="text" height={20} width="66%" />
        <Skeleton variant="text" height={20} width="100%" />
        {closeButton}
      </TitleSectionContainer>
    )
  }
}

const ImageSection: React.FC<{
  resource?: LearningResource
  config: ImageConfig
}> = ({ resource, config }) => {
  const aspect = config.width / config.height
  if (resource?.resource_type === "video" && resource?.url) {
    return (
      <VideoFrame src={resource.url} title={resource.title} aspect={aspect} />
    )
  } else if (resource?.image) {
    return (
      <ImageContainer>
        <Image
          src={resource.image?.url ?? DEFAULT_RESOURCE_IMG}
          alt={resource?.image.alt ?? ""}
          aspect={aspect}
          fill
        />
      </ImageContainer>
    )
  } else if (resource) {
    return (
      <ImageContainer>
        <Image
          src={DEFAULT_RESOURCE_IMG}
          alt={resource.image?.alt ?? ""}
          aspect={aspect}
          fill
        />
      </ImageContainer>
    )
  } else {
    return (
      <SkeletonImage
        variant="rectangular"
        aspect={config.width / config.height}
      />
    )
  }
}

const getCallToActionUrl = (resource: LearningResource) => {
  switch (resource.resource_type) {
    case ResourceTypeEnum.PodcastEpisode:
      return resource.podcast_episode?.episode_link
    default:
      return resource.url
  }
}

const getCallToActionText = (resource: LearningResource): string => {
  const accessCourseMaterials = "Access Course Materials"
  const watchOnYouTube = "Watch on YouTube"
  const listenToPodcast = "Listen to Podcast"
  const learnMore = "Learn More"
  const callsToAction = {
    [ResourceTypeEnum.Course]: learnMore,
    [ResourceTypeEnum.Program]: learnMore,
    [ResourceTypeEnum.LearningPath]: learnMore,
    [ResourceTypeEnum.Video]: watchOnYouTube,
    [ResourceTypeEnum.VideoPlaylist]: watchOnYouTube,
    [ResourceTypeEnum.Podcast]: listenToPodcast,
    [ResourceTypeEnum.PodcastEpisode]: listenToPodcast,
  }
  if (
    resource?.resource_type === ResourceTypeEnum.Video ||
    resource?.resource_type === ResourceTypeEnum.VideoPlaylist
  ) {
    // Video resources should always show "Watch on YouTube" as the CTA
    return watchOnYouTube
  } else {
    if (resource?.platform?.code === PlatformEnum.Ocw) {
      // Non-video OCW resources should show "Access Course Materials" as the CTA
      return accessCourseMaterials
    } else {
      // Return the default CTA for the resource type
      return callsToAction[resource?.resource_type] || learnMore
    }
  }
}

const CallToActionSection = ({
  imgConfig,
  resource,
  hide,
  user,
  inUserList,
  inLearningPath,
  onAddToLearningPathClick,
  onAddToUserListClick,
}: {
  imgConfig: ImageConfig
  resource?: LearningResource
  hide?: boolean
  user?: User
  inUserList?: boolean
  inLearningPath?: boolean
  onAddToLearningPathClick?: LearningResourceCardProps["onAddToLearningPathClick"]
  onAddToUserListClick?: LearningResourceCardProps["onAddToUserListClick"]
}) => {
  if (hide) {
    return null
  }

  if (!resource) {
    return (
      <PlatformContainer>
        <Skeleton height={70} width="50%" />
        <Skeleton height={50} width="25%" />
      </PlatformContainer>
    )
  }
  const { platform } = resource!
  const offeredBy = resource?.offered_by
  const platformCode =
    (offeredBy?.code as PlatformEnum) === PlatformEnum.Xpro
      ? (offeredBy?.code as PlatformEnum)
      : (platform?.code as PlatformEnum)
  const platformImage = PLATFORM_LOGOS[platformCode]?.image
  const cta = getCallToActionText(resource)
  return (
    <CallToAction data-testid="drawer-cta">
      <ImageSection resource={resource} config={imgConfig} />
      <StyledLink
        target="_blank"
        size="medium"
        data-ph-action="click-cta"
        data-ph-offered-by={offeredBy?.code}
        data-ph-resource-type={resource.resource_type}
        data-ph-resource-id={resource.id}
        endIcon={<RiExternalLinkLine />}
        href={getCallToActionUrl(resource) || ""}
      >
        {cta}
      </StyledLink>
      <PlatformContainer>
        {platformImage ? (
          <Platform>
            <OnPlatform>on</OnPlatform>
            <StyledPlatformLogo platformCode={platformCode} height={26} />
          </Platform>
        ) : null}
        <ListButtonContainer>
          {user?.is_learning_path_editor && (
            <CardActionButton
              filled={inLearningPath}
              aria-label="Add to Learning Path"
              onClick={(event) =>
                onAddToLearningPathClick
                  ? onAddToLearningPathClick(event, resource.id)
                  : null
              }
            >
              <RiMenuAddLine aria-hidden />
            </CardActionButton>
          )}
          <CardActionButton
            filled={inUserList}
            aria-label={`Bookmark ${getReadableResourceType(resource.resource_type)}`}
            onClick={
              onAddToUserListClick
                ? (event) => onAddToUserListClick?.(event, resource.id)
                : undefined
            }
          >
            <RiBookmarkLine aria-hidden />
          </CardActionButton>
        </ListButtonContainer>
      </PlatformContainer>
    </CallToAction>
  )
}

const ResourceDescription = ({ resource }: { resource?: LearningResource }) => {
  const firstRender = useRef(true)
  const clampedOnFirstRender = useRef(false)
  const [isClamped, setClamped] = useState(false)
  const [isExpanded, setExpanded] = useState(false)
  const descriptionRendered = useCallback((node: HTMLDivElement) => {
    if (node !== null) {
      const clamped = node.scrollHeight > node.clientHeight
      setClamped(clamped)
      if (firstRender.current) {
        firstRender.current = false
        clampedOnFirstRender.current = clamped
        return
      }
    }
  }, [])
  const DescriptionText = isExpanded
    ? DescriptionExpanded
    : DescriptionCollapsed
  if (!resource) {
    return (
      <>
        <Skeleton variant="text" width="100%" />
        <Skeleton variant="text" width="100%" />
        <Skeleton variant="text" width="100%" />
        <Skeleton variant="text" width="100%" />
        <Skeleton variant="text" width="100%" />
        <Skeleton variant="text" width="33%" />
      </>
    )
  }
  return (
    <DescriptionContainer data-testid="drawer-description-container">
      <DescriptionText
        data-testid="drawer-description-text"
        ref={descriptionRendered}
        /**
         * Resource descriptions can contain HTML. They are santiized on the
         * backend during ETL. This is safe to render.
         */
        dangerouslySetInnerHTML={{ __html: resource.description || "" }}
      />
      {(isClamped || clampedOnFirstRender.current) && (
        <Link color="red" size="small" onClick={() => setExpanded(!isExpanded)}>
          {isExpanded ? "Show less" : "Show more"}
        </Link>
      )}
    </DescriptionContainer>
  )
}

const LearningResourceExpandedV2: React.FC<LearningResourceExpandedV2Props> = ({
  resource,
  imgConfig,
  user,
  carousels,
  inUserList,
  inLearningPath,
  onAddToLearningPathClick,
  onAddToUserListClick,
  closeDrawer,
}) => {
  return (
    <OuterContainer>
      <TitleSection
        resource={resource}
        closeDrawer={closeDrawer ?? (() => {})}
      />
      <Container>
        <ContentContainer>
          <LeftContainer>
            <ResourceDescription resource={resource} />
            <InfoSectionV2 resource={resource} />
          </LeftContainer>
          <RightContainer>
            <CallToActionSection
              imgConfig={imgConfig}
              resource={resource}
              user={user}
              inLearningPath={inLearningPath}
              inUserList={inUserList}
              onAddToLearningPathClick={onAddToLearningPathClick}
              onAddToUserListClick={onAddToUserListClick}
            />
          </RightContainer>
        </ContentContainer>
      </Container>
      <CarouselContainer>
        {carousels?.map((carousel, index) => <div key={index}>{carousel}</div>)}
      </CarouselContainer>
    </OuterContainer>
  )
}

export { LearningResourceExpandedV2, getCallToActionText }
export type { LearningResourceExpandedV2Props }
