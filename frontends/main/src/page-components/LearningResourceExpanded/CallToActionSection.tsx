import React, { useState } from "react"
import styled from "@emotion/styled"
import { default as NextImage } from "next/image"
import { useFeatureFlagEnabled, usePostHog } from "posthog-js/react"
import {
  Skeleton,
  theme,
  PlatformLogo,
  PLATFORM_LOGOS,
  Typography,
} from "ol-components"
import Link from "next/link"
import type { ImageConfig, LearningResourceCardProps } from "ol-components"
import {
  DEFAULT_RESOURCE_IMG,
  resourceContentFilesImageSrc,
  useImageWithFallback,
} from "ol-utilities"
import { ResourceTypeEnum, ResourceTypeGroupEnum, PlatformEnum } from "api"
import { Button, ButtonLink, ButtonProps, Input } from "@mitodl/smoot-design"
import type { LearningResource } from "api"
import {
  RiBookmarkFill,
  RiBookmarkLine,
  RiFacebookFill,
  RiLink,
  RiLinkedinFill,
  RiExternalLinkLine,
  RiMenuAddLine,
  RiShareLine,
  RiTwitterXLine,
} from "@remixicon/react"
import type { User } from "api/hooks/user"
import { PostHogEvents } from "@/common/constants"
import { kebabCase } from "lodash"
import {
  FACEBOOK_SHARE_BASE_URL,
  TWITTER_SHARE_BASE_URL,
  LINKEDIN_SHARE_BASE_URL,
  coursePageView,
  programPageView,
  videoDetailPageView,
  videoPlaylistPageView,
  podcastPageView,
  podcastEpisodePageView,
} from "@/common/urls"
import { DisplayModeEnum } from "@mitodl/mitxonline-api-axios/v2"
import { FeatureFlags } from "@/common/feature_flags"
import { externalLinkProps } from "@/common/utils"
import invariant from "tiny-invariant"

const NEXT_PUBLIC_ORIGIN = process.env.NEXT_PUBLIC_ORIGIN
invariant(NEXT_PUBLIC_ORIGIN, "NEXT_PUBLIC_ORIGIN must be defined")

const showChatClass = "show-chat"
const showChatSelector = `.${showChatClass} &`

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
  [showChatSelector]: {
    [theme.breakpoints.up("sm")]: {
      width: "auto",
      maxWidth: "424px",
    },
    [theme.breakpoints.down("md")]: {
      width: "100%",
      padding: "0",
      border: "none",
      boxShadow: "none",
    },
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
  "&:hover": {
    color: theme.custom.colors.lightRed,
  },
})

const RedLinkIcon = styled(RiLink)({
  color: theme.custom.colors.red,
})

const CopyLinkButton = styled(Button)({
  flexGrow: 0,
  flexBasis: "112px",
})

const SkeletonImage = styled(Skeleton)<{ aspect: number }>((aspect) => ({
  borderRadius: "8px",
  paddingBottom: `${100 / aspect.aspect}%`,
}))

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

const ImageSection: React.FC<{
  resource?: LearningResource
  config: ImageConfig
}> = ({ resource, config }) => {
  const { src: imageUrl, onError: onImageError } = useImageWithFallback(
    resource?.image?.url ??
      (resource ? resourceContentFilesImageSrc(resource) : null),
    DEFAULT_RESOURCE_IMG,
  )
  const aspect = config.width / config.height
  if (resource) {
    return (
      <ImageContainer>
        <Image
          src={imageUrl}
          alt={resource?.image?.alt ?? ""}
          aspect={aspect}
          fill
          onError={onImageError}
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

const getCallToActionText = (resource: LearningResource): string => {
  const accessCourseMaterials = "Access Course Materials"
  const accessLearningMaterial = "Access Learning Material"
  const listenToPodcast = "Listen to Podcast"
  const viewArticle = "View Article"
  const learnMore = "Learn More"
  const callsToAction = {
    [ResourceTypeEnum.Course]: learnMore,
    [ResourceTypeEnum.Program]: learnMore,
    [ResourceTypeEnum.LearningPath]: learnMore,
    [ResourceTypeEnum.Video]: learnMore,
    [ResourceTypeEnum.VideoPlaylist]: learnMore,
    [ResourceTypeEnum.Podcast]: listenToPodcast,
    [ResourceTypeEnum.PodcastEpisode]: listenToPodcast,
    [ResourceTypeEnum.Document]: learnMore,
  }

  if (resource?.resource_category === "Article") {
    return viewArticle
  }

  if (resource?.platform?.code === PlatformEnum.Ocw) {
    if (resource.resource_type === ResourceTypeEnum.Course) {
      return accessCourseMaterials
    } else {
      return accessLearningMaterial
    }
  }

  // Return the default CTA for the resource type
  return callsToAction[resource?.resource_type] || learnMore
}

const appendUtmParams = (url?: string | null, resourceTitle?: string) => {
  if (!url) return "#"
  try {
    const parsedUrl = new URL(url, NEXT_PUBLIC_ORIGIN)
    if (parsedUrl.href.startsWith(NEXT_PUBLIC_ORIGIN)) {
      // Do not add UTM params for internal URLs
      return url
    }
    parsedUrl.searchParams.set("utm_source", "mit-learn")
    parsedUrl.searchParams.set("utm_medium", "referral")
    if (resourceTitle) {
      parsedUrl.searchParams.set("utm_content", kebabCase(resourceTitle))
    }
    return parsedUrl.toString()
  } catch {
    const separator = url.includes("?") ? "&" : "?"
    const utm = `utm_source=mit-learn&utm_medium=referral${resourceTitle ? `&utm_content=${kebabCase(resourceTitle)}` : ""}`
    return `${url}${separator}${utm}`
  }
}

const getResourceUrl = (
  resource: LearningResource,
  {
    ocwProductPages,
    mitxonlineProductPages,
    showVideoPlaylistPage,
    showPodcastPage,
  }: {
    mitxonlineProductPages?: boolean
    showVideoPlaylistPage?: boolean
    showPodcastPage?: boolean
    ocwProductPages?: boolean
  },
) => {
  if (
    ocwProductPages &&
    resource.platform?.code === PlatformEnum.Ocw &&
    resource.url
  ) {
    const url = new URL(resource.url)
    return url.pathname.replace(/^\/courses/, "/courses/o")
  }
  if (
    mitxonlineProductPages &&
    resource.platform?.code === PlatformEnum.Mitxonline
  ) {
    /**
     * TODO: After mitxonlineProductPages feature flag is fully rolled out,
     * this logic should be handled during ETL
     */
    if (resource.resource_type === ResourceTypeEnum.Course) {
      return coursePageView(resource.readable_id)
    } else if (resource.resource_type === ResourceTypeEnum.Program) {
      return programPageView({
        readable_id: resource.readable_id,
        // Learn program resources that have resource_type_group correspond to
        // MITxOnline programs with display_mode="course"
        // This can be moved into backend ETL after feature flags are removed.
        display_mode:
          resource.resource_type_group === ResourceTypeGroupEnum.Course
            ? DisplayModeEnum.Course
            : undefined,
      })
    }
  }
  if (showVideoPlaylistPage) {
    if (resource.resource_type === ResourceTypeEnum.VideoPlaylist) {
      return videoPlaylistPageView(resource.id.toString())
    }
    if (
      resource.resource_type === ResourceTypeEnum.Video &&
      resource?.playlists?.length > 0
    ) {
      return videoDetailPageView(resource.id, Number(resource.playlists[0]))
    }
  }

  if (showPodcastPage) {
    if (resource.resource_type === ResourceTypeEnum.Podcast) {
      return podcastPageView(resource.id.toString())
    }
    if (
      resource.resource_type === ResourceTypeEnum.PodcastEpisode &&
      resource?.podcast_episode?.podcasts?.[0]
    ) {
      return podcastEpisodePageView(
        resource.id.toString(),
        resource?.podcast_episode?.podcasts[0].toString(),
      )
    }
  }
  return resource.url
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
  const ocwProductPages = useFeatureFlagEnabled(FeatureFlags.OcwProductPages)
  const mitxonlineProductPages = useFeatureFlagEnabled(
    FeatureFlags.MitxOnlineProductPages,
  )
  const showVideoPlaylistPage = useFeatureFlagEnabled(
    FeatureFlags.VideoPlaylistPage,
  )
  const showPodcastPage = useFeatureFlagEnabled(FeatureFlags.PodcastDetailPage)

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
  const { platform } = resource
  const offeredBy = resource.offered_by
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
  const url = appendUtmParams(
    getResourceUrl(resource, {
      mitxonlineProductPages,
      showVideoPlaylistPage,
      showPodcastPage,
      ocwProductPages,
    }),
    resource.title,
  )

  return (
    <CallToAction data-testid="drawer-cta">
      <ImageSection resource={resource} config={imgConfig} />
      <ActionsContainer>
        <StyledLink
          {...externalLinkProps(url, {
            endIcon: <RiExternalLinkLine />,
          })}
          size="medium"
          href={url}
          onClick={() => {
            if (process.env.NEXT_PUBLIC_POSTHOG_API_KEY) {
              posthog.capture(PostHogEvents.CallToActionClicked, {
                resource,
                label: cta,
              })
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
                href={`${FACEBOOK_SHARE_BASE_URL}?u=${encodeURIComponent(shareUrl)}`}
                target="_blank"
              >
                <RiFacebookFill size={socialIconSize} />
              </ShareLink>
              <ShareLink
                href={`${TWITTER_SHARE_BASE_URL}?text=${encodeURIComponent(resource.title)}&url=${encodeURIComponent(shareUrl)}`}
                target="_blank"
              >
                <RiTwitterXLine size={socialIconSize} />
              </ShareLink>
              <ShareLink
                href={`${LINKEDIN_SHARE_BASE_URL}?url=${encodeURIComponent(shareUrl)}`}
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

export default CallToActionSection
export { getCallToActionText }
