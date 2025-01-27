import React, { useCallback, useEffect, useRef, useState } from "react"
import styled from "@emotion/styled"
import {
  Skeleton,
  theme,
  PlatformLogo,
  PLATFORM_LOGOS,
  Link,
  Input,
  Typography,
  Stack,
} from "ol-components"
import type { ImageConfig, LearningResourceCardProps } from "ol-components"
import { default as NextImage } from "next/image"
import {
  ActionButton,
  Button,
  ButtonLink,
  ButtonProps,
} from "@mitodl/smoot-design"
import { AiChat } from "@mitodl/smoot-design/ai"
import type { LearningResource } from "api"
import { ResourceTypeEnum, PlatformEnum } from "api"
import {
  DEFAULT_RESOURCE_IMG,
  getReadableResourceType,
  useToggle,
} from "ol-utilities"
import {
  RiBookmarkFill,
  RiBookmarkLine,
  RiCloseLargeLine,
  RiExternalLinkLine,
  RiFacebookFill,
  RiLink,
  RiLinkedinFill,
  RiMenuAddLine,
  RiShareLine,
  RiTwitterXLine,
  RiSparkling2Line,
} from "@remixicon/react"

import InfoSection from "./InfoSection"
import type { User } from "api/hooks/user"
import VideoFrame from "./VideoFrame"
import { usePostHog } from "posthog-js/react"
import classNames from "classnames"

const DRAWER_WIDTH = "900px"

const Outer = styled.div({
  display: "flex",
  flexDirection: "column",
  flexGrow: 1,
  width: "100%",
  overflowX: "hidden",
})

const TitleContainer = styled.div({
  display: "flex",
  position: "sticky",
  justifyContent: "space-between",
  top: "0",
  padding: "24px 28px",
  gap: "16px",
  zIndex: 1,
  backgroundColor: theme.custom.colors.white,
  [theme.breakpoints.down("md")]: {
    padding: "24px 16px",
  },
})

const TopContainer = styled.div({
  display: "flex",
  flexDirection: "column",
  padding: "0 28px 24px",
  [theme.breakpoints.down("md")]: {
    width: "auto",
    padding: "0 16px 24px",
  },
})

const BottomContainer = styled.div({
  display: "flex",
  flexDirection: "column",
  flexGrow: 1,
  alignItems: "flex-start",
  padding: "32px 28px",
  gap: "32px",
  borderTop: `1px solid ${theme.custom.colors.lightGray2}`,
  background: theme.custom.colors.lightGray1,
  "> div": {
    width: "100%",
  },
  [theme.breakpoints.down("md")]: {
    padding: "16px 0 16px 16px",
  },
})

const TUTOR_WIDTH = "388px"
const MainCol = styled.div({
  // Note: Without a width specified, the carousels will overflow up to 100vw
  maxWidth: DRAWER_WIDTH,
  [theme.breakpoints.down("md")]: {
    width: "100%",
  },
  ".tutor-enabled &": {
    maxWidth: `calc(${DRAWER_WIDTH} - ${TUTOR_WIDTH})`,
  },
})
const ChatCol = styled.div({
  width: TUTOR_WIDTH,
  zIndex: 2,
  position: "sticky",
  top: 96,
  height: "calc(100vh - 96px)",
})

const ContentContainer = styled.div({
  display: "flex",
  gap: "32px",
  [theme.breakpoints.down("md")]: {
    alignItems: "center",
    flexDirection: "column-reverse",
    gap: "16px",
  },
  ".tutor-enabled &": {
    alignItems: "center",
    flexDirection: "column-reverse",
    gap: "16px",
  },
})

const ContentLeft = styled.div({
  display: "flex",
  flexDirection: "column",
  flexGrow: 1,
  alignItems: "flex-start",
  gap: "24px",
  maxWidth: "100%",
})

const ContentRight = styled.div({
  display: "flex",
  flexDirection: "column",
  width: "100%",
  gap: "24px",
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
  ".tutor-enabled &": {
    width: "100%",
    padding: "0",
    border: "none",
    boxShadow: "none",
  },
})

const ActionsContainer = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "16px",
  width: "100%",
})

const PlatformContainer = styled.div({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
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
  wordBreak: "break-word",
  "> *": {
    ":first-child": {
      marginTop: 0,
    },
    ":last-child": {
      marginBottom: 0,
    },
    ":empty": {
      display: "none",
    },
  },
})

const DescriptionCollapsed = styled(Description)({
  display: "-webkit-box",
  overflow: "hidden",
  maxHeight: `calc(${theme.typography.body2.lineHeight} * 5)`,
  "@supports (-webkit-line-clamp: 5)": {
    maxHeight: "unset",
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

const ButtonContainer = styled.div({
  display: "flex",
  width: "100%",
  gap: "8px",
  flexGrow: 1,
  justifyContent: "center",
})

const SelectableButton = styled(Button)<{ selected?: boolean }>((props) => [
  {
    flex: 1,
    whiteSpace: "nowrap",
  },
  props.selected
    ? {
        backgroundColor: theme.custom.colors.red,
        border: `1px solid ${theme.custom.colors.red}`,
        color: theme.custom.colors.white,
        "&:hover:not(:disabled)": {
          backgroundColor: theme.custom.colors.red,
          border: `1px solid ${theme.custom.colors.red}`,
          color: theme.custom.colors.white,
        },
      }
    : {},
])

const ShareContainer = styled.div({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  alignSelf: "stretch",
  padding: "16px 0 8px 0",
  gap: "12px",
})

const ShareLabel = styled(Typography)({
  ...theme.typography.body3,
  color: theme.custom.colors.darkGray1,
})

const ShareButtonContainer = styled.div({
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  alignSelf: "stretch",
  gap: "16px",
  a: {
    height: "18px",
  },
})

const ShareLink = styled(Link)({
  color: theme.custom.colors.silverGrayDark,
})

const RedLinkIcon = styled(RiLink)({
  color: theme.custom.colors.red,
})

const CopyLinkButton = styled(Button)({
  flexGrow: 0,
  flexBasis: "112px",
})

const TopCarouselContainer = styled.div({
  display: "flex",
  flexDirection: "column",
  paddingTop: "24px",
})

type LearningResourceExpandedProps = {
  resourceId: number
  titleId?: string
  resource?: LearningResource
  user?: User
  shareUrl?: string
  imgConfig: ImageConfig
  topCarousels?: React.ReactNode[]
  bottomCarousels?: React.ReactNode[]
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
  titleId?: string
  resource?: LearningResource
  closeDrawer: () => void
}> = ({ resource, closeDrawer, titleId }) => {
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

  const type = resource ? (
    getReadableResourceType(resource.resource_type)
  ) : (
    <Skeleton variant="text" width="33%" />
  )
  const title = resource ? (
    resource.title
  ) : (
    <Skeleton
      // Ideally the resource data is loaded before the drawer opens, e.g., by
      // a server prefetch or by setQueryData in a parent component.
      // This is a fallback.
      aria-label="Resource Details Loading"
      variant="text"
      height={20}
      width="80%"
    />
  )

  return (
    <TitleContainer>
      <Typography
        variant="h4"
        id={titleId}
        width="100%"
        color={theme.custom.colors.darkGray2}
      >
        <Typography
          variant="subtitle2"
          color={theme.custom.colors.silverGrayDark}
        >
          {type}
        </Typography>
        {title}
      </Typography>
      {closeButton}
    </TitleContainer>
  )
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
  } else if (resource) {
    return (
      <ImageContainer>
        <Image
          src={resource.image?.url ?? DEFAULT_RESOURCE_IMG}
          alt={resource?.image?.alt ?? ""}
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

const CallToActionButton: React.FC<ButtonProps & { selected?: boolean }> = (
  props,
) => {
  return (
    <SelectableButton
      size="small"
      edge="circular"
      variant="bordered"
      {...props}
    />
  )
}

const CallToActionSection = ({
  imgConfig,
  resource,
  hide,
  user,
  shareUrl,
  inUserList,
  inLearningPath,
  onAddToLearningPathClick,
  onAddToUserListClick,
}: {
  imgConfig: ImageConfig
  resource?: LearningResource
  hide?: boolean
  user?: User
  shareUrl?: string
  inUserList?: boolean
  inLearningPath?: boolean
  onAddToLearningPathClick?: LearningResourceCardProps["onAddToLearningPathClick"]
  onAddToUserListClick?: LearningResourceCardProps["onAddToUserListClick"]
}) => {
  const posthog = usePostHog()
  const [shareExpanded, setShareExpanded] = useState(false)
  const [copyText, setCopyText] = useState("Copy Link")
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
  const addToLearningPathLabel = "Add to list"
  const bookmarkLabel = "Bookmark"
  const shareLabel = "Share"
  const socialIconSize = 18
  const facebookShareBaseUrl = "https://www.facebook.com/sharer/sharer.php"
  const twitterShareBaseUrl = "https://x.com/share"
  const linkedInShareBaseUrl = "https://www.linkedin.com/sharing/share-offsite"
  return (
    <CallToAction data-testid="drawer-cta">
      <ImageSection resource={resource} config={imgConfig} />
      <ActionsContainer>
        <StyledLink
          target="_blank"
          size="medium"
          endIcon={<RiExternalLinkLine />}
          href={resource.url || ""}
          onClick={() => {
            if (process.env.NEXT_PUBLIC_POSTHOG_API_KEY) {
              posthog.capture("cta_clicked", { resource })
            }
          }}
          data-ph-action="click-cta"
          data-ph-offered-by={offeredBy?.code}
          data-ph-resource-type={resource.resource_type}
          data-ph-resource-id={resource.id}
        >
          {cta}
        </StyledLink>
        {platformImage ? (
          <PlatformContainer>
            <Platform>
              <OnPlatform>on</OnPlatform>
              <StyledPlatformLogo platformCode={platformCode} height={26} />
            </Platform>
          </PlatformContainer>
        ) : null}
        <ButtonContainer>
          {user?.is_learning_path_editor && (
            <CallToActionButton
              selected={inLearningPath}
              startIcon={<RiMenuAddLine />}
              aria-label={addToLearningPathLabel}
              onClick={(event) =>
                onAddToLearningPathClick
                  ? onAddToLearningPathClick(event, resource.id)
                  : null
              }
            >
              {addToLearningPathLabel}
            </CallToActionButton>
          )}
          <CallToActionButton
            selected={inUserList}
            startIcon={inUserList ? <RiBookmarkFill /> : <RiBookmarkLine />}
            aria-label={bookmarkLabel}
            onClick={
              onAddToUserListClick
                ? (event) => onAddToUserListClick?.(event, resource.id)
                : undefined
            }
          >
            {bookmarkLabel}
          </CallToActionButton>
          <CallToActionButton
            selected={shareExpanded}
            startIcon={<RiShareLine />}
            aria-label={shareLabel}
            onClick={() => setShareExpanded(!shareExpanded)}
          >
            {shareLabel}
          </CallToActionButton>
        </ButtonContainer>
        {shareExpanded && shareUrl && (
          <ShareContainer data-testid="drawer-share">
            <ShareLabel>Share a link to this Resource</ShareLabel>
            <Input
              fullWidth
              value={shareUrl}
              onClick={(event) => {
                const input = event.currentTarget.querySelector("input")
                if (!input) return
                input.select()
              }}
            />
            <ShareButtonContainer>
              <ShareLink
                href={`${facebookShareBaseUrl}?u=${encodeURIComponent(shareUrl)}`}
                target="_blank"
              >
                <RiFacebookFill size={socialIconSize} />
              </ShareLink>
              <ShareLink
                href={`${twitterShareBaseUrl}?text=${encodeURIComponent(resource.title)}&url=${encodeURIComponent(shareUrl)}`}
                target="_blank"
              >
                <RiTwitterXLine size={socialIconSize} />
              </ShareLink>
              <ShareLink
                href={`${linkedInShareBaseUrl}?url=${encodeURIComponent(shareUrl)}`}
                target="_blank"
              >
                <RiLinkedinFill size={socialIconSize} />
              </ShareLink>
              <CopyLinkButton
                size="small"
                edge="circular"
                variant="bordered"
                startIcon={<RedLinkIcon />}
                aria-label={copyText}
                onClick={() => {
                  navigator.clipboard.writeText(shareUrl)
                  setCopyText("Copied!")
                }}
              >
                {copyText}
              </CopyLinkButton>
            </ShareButtonContainer>
          </ShareContainer>
        )}
      </ActionsContainer>
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
         * Resource descriptions can contain HTML. They are sanitized on the
         * backend during ETL. This is safe to render.
         */
        dangerouslySetInnerHTML={{ __html: resource.description || "" }}
      />
      {(isClamped || clampedOnFirstRender.current) && (
        <Link
          scroll={false}
          color="red"
          size="small"
          onClick={() => setExpanded(!isExpanded)}
        >
          {isExpanded ? "Show less" : "Show more"}
        </Link>
      )}
    </DescriptionContainer>
  )
}

const LearningResourceExpanded: React.FC<LearningResourceExpandedProps> = ({
  resourceId,
  resource,
  imgConfig,
  user,
  shareUrl,
  topCarousels,
  bottomCarousels,
  inUserList,
  inLearningPath,
  titleId,
  onAddToLearningPathClick,
  onAddToUserListClick,
  closeDrawer,
}) => {
  const [showTutor, setShowTutor] = useToggle(false)
  const outerContainerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (outerContainerRef.current && outerContainerRef.current.scrollTo) {
      outerContainerRef.current.scrollTo(0, 0)
    }
  }, [resourceId])
  return (
    <Outer
      className={classNames({ "tutor-enabled": showTutor })}
      ref={outerContainerRef}
    >
      <TitleSection
        titleId={titleId}
        resource={resource}
        closeDrawer={closeDrawer ?? (() => {})}
      />
      <Stack direction="row" alignItems="start">
        <MainCol>
          <TopContainer>
            <ContentContainer>
              <ContentLeft>
                <ResourceDescription resource={resource} />
                <InfoSection resource={resource} />
              </ContentLeft>
              <ContentRight>
                <CallToActionSection
                  imgConfig={imgConfig}
                  resource={resource}
                  user={user}
                  shareUrl={shareUrl}
                  inLearningPath={inLearningPath}
                  inUserList={inUserList}
                  onAddToLearningPathClick={onAddToLearningPathClick}
                  onAddToUserListClick={onAddToUserListClick}
                />
                {showTutor ? null : (
                  <Button
                    onClick={setShowTutor.on}
                    variant="secondary"
                    endIcon={<RiSparkling2Line />}
                  >
                    Need help? Ask our Tutor.
                  </Button>
                )}
              </ContentRight>
            </ContentContainer>
            {topCarousels && (
              <TopCarouselContainer>
                {topCarousels?.map((carousel, index) => (
                  <div key={index}>{carousel}</div>
                ))}
              </TopCarouselContainer>
            )}
          </TopContainer>
          <BottomContainer>
            {bottomCarousels?.map((carousel, index) => (
              <div key={index}>{carousel}</div>
            ))}
          </BottomContainer>
        </MainCol>
        <ChatCol>
          <AiChat
            chatId={`chat-${resourceId}`}
            title="MIT Teaching Assistant"
            onClose={setShowTutor.off}
            ImgComponent={NextImage}
            initialMessages={[
              {
                content: "Hello",
                role: "assistant",
              },
            ]}
            requestOpts={{
              apiUrl: "https://api.example.com",
            }}
          />
        </ChatCol>
      </Stack>
    </Outer>
  )
}

export { LearningResourceExpanded, getCallToActionText }
export type { LearningResourceExpandedProps }
