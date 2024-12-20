import React, { useEffect, useState } from "react"
import styled from "@emotion/styled"
import Skeleton from "@mui/material/Skeleton"
import Typography from "@mui/material/Typography"
import { default as NextImage } from "next/image"
import { ButtonLink } from "../Button/Button"
import type { LearningResource, LearningResourceRun } from "api"
import { ResourceTypeEnum, PlatformEnum } from "api"
import {
  NoSSR,
  formatDate,
  capitalize,
  DEFAULT_RESOURCE_IMG,
  showStartAnytime,
} from "ol-utilities"
import { RiExternalLinkLine } from "@remixicon/react"
import { theme } from "../ThemeProvider/ThemeProvider"
import { SimpleSelect } from "../SimpleSelect/SimpleSelect"
import type { SimpleSelectProps } from "../SimpleSelect/SimpleSelect"
import { PlatformLogo, PLATFORM_LOGOS } from "../Logo/Logo"
import InfoSectionV1 from "./InfoSectionV1"
import type { User } from "api/hooks/user"
import { LearningResourceCardProps } from "../LearningResourceCard/LearningResourceCard"
import type { ImageConfig } from "../../constants/imgConfigs"
import VideoFrame from "./VideoFrame"

const Container = styled.div<{ padTop?: boolean }>`
  display: flex;
  flex-direction: column;
  padding: 18px 32px 160px;
  gap: 20px;
  ${({ padTop }) => (padTop ? "padding-top: 64px;" : "")}
  width: 516px;
  ${({ theme }) => theme.breakpoints.down("sm")} {
    width: auto;
  }
`

const DateContainer = styled.div`
  display: flex;
  justify-content: start;
  align-self: stretch;
  align-items: center;
  ${{ ...theme.typography.body2 }}
  color: ${theme.custom.colors.black};
  margin: 0;

  .MuiInputBase-root {
    margin-bottom: 0;
    border-color: ${theme.custom.colors.mitRed};
    border-width: 1.5px;
    color: ${theme.custom.colors.mitRed};
    ${{ ...theme.typography.button }}
    line-height: ${theme.typography.pxToRem(20)};

    label {
      display: none;
    }

    svg {
      color: ${theme.custom.colors.mitRed};
    }
  }
`

const DateSingle = styled(DateContainer)`
  margin-top: 10px;
`

const NoDateSpacer = styled.div`
  height: 34px;
`

const DateLabel = styled.span`
  ${{ ...theme.typography.body2 }}
  color: ${theme.custom.colors.darkGray1};
  margin-right: 16px;
`

const ImageContainer = styled.div<{ aspect: number }>`
  position: relative;
  width: 100%;
  padding-bottom: ${({ aspect }) => 100 / aspect}%;
`

const Image = styled(NextImage)`
  border-radius: 8px;
  width: 100%;
  object-fit: cover;
`

const SkeletonImage = styled(Skeleton)<{ aspect: number }>`
  border-radius: 8px;
  padding-bottom: ${({ aspect }) => 100 / aspect}%;
`

const CallToAction = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  ${({ theme }) => theme.breakpoints.down("sm")} {
    flex-wrap: wrap;
    justify-content: center;
  }
`

const StyledLink = styled(ButtonLink)`
  text-align: center;
  width: 224px;
  ${({ theme }) => theme.breakpoints.down("sm")} {
    width: 100%;
    margin-top: 10px;
    margin-bottom: 10px;
  }
`

const Platform = styled.div`
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 16px;
`

const Detail = styled.section`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const Description = styled.p`
  ${{ ...theme.typography.body2 }}
  color: ${theme.custom.colors.darkGray2};
  margin: 0;
  white-space: pre-line;
`

const StyledPlatformLogo = styled(PlatformLogo)`
  height: 26px;
  max-width: 180px;
`

const OnPlatform = styled.span`
  ${{ ...theme.typography.body2 }}
  color: ${theme.custom.colors.black};
`

type LearningResourceExpandedV1Props = {
  resource?: LearningResource
  titleId?: string
  user?: User
  imgConfig: ImageConfig
  inLearningPath?: boolean
  inUserList?: boolean
  onAddToLearningPathClick?: LearningResourceCardProps["onAddToLearningPathClick"]
  onAddToUserListClick?: LearningResourceCardProps["onAddToUserListClick"]
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
      <ImageContainer aspect={aspect}>
        <Image
          src={resource.image?.url ?? DEFAULT_RESOURCE_IMG}
          alt={resource?.image.alt ?? ""}
          fill
        />
      </ImageContainer>
    )
  } else if (resource) {
    return (
      <ImageContainer aspect={aspect}>
        <Image
          src={DEFAULT_RESOURCE_IMG}
          alt={resource.image?.alt ?? ""}
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

const CallToActionSection = ({
  resource,
  hide,
}: {
  resource?: LearningResource
  hide?: boolean
}) => {
  if (hide) {
    return null
  }

  if (!resource) {
    return (
      <CallToAction>
        <Skeleton height={70} width="50%" />
        <Skeleton height={50} width="25%" />
      </CallToAction>
    )
  }
  const { platform } = resource!
  const offeredBy = resource?.offered_by
  const platformCode =
    (offeredBy?.code as PlatformEnum) === PlatformEnum.Xpro
      ? (offeredBy?.code as PlatformEnum)
      : (platform?.code as PlatformEnum)
  const platformImage = PLATFORM_LOGOS[platformCode]?.image

  const getCallToActionText = (resource: LearningResource): string => {
    if (resource?.platform?.code === PlatformEnum.Ocw) {
      return "Access Course Materials"
    } else if (
      resource?.resource_type === ResourceTypeEnum.Podcast ||
      resource?.resource_type === ResourceTypeEnum.PodcastEpisode
    ) {
      return "Listen to Podcast"
    }
    return "Learn More"
  }

  const cta = getCallToActionText(resource)
  return (
    <CallToAction>
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
      {platformImage ? (
        <Platform>
          <OnPlatform>on</OnPlatform>
          <StyledPlatformLogo platformCode={platformCode} height={26} />
        </Platform>
      ) : null}
    </CallToAction>
  )
}

const DetailSection = ({
  resource,
  titleId,
}: {
  resource?: LearningResource
  titleId?: string
}) => {
  return (
    <Detail>
      <ResourceTitle id={titleId} resource={resource} />
      <ResourceDescription resource={resource} />
    </Detail>
  )
}

const ResourceTitle = ({
  resource,
  id,
}: {
  resource?: LearningResource
  id?: string
}) => {
  if (!resource) {
    return <Skeleton variant="text" height={20} width="66%" />
  }
  return (
    <Typography id={id} variant="h5" component="h2">
      {resource.title}
    </Typography>
  )
}

const ResourceDescription = ({ resource }: { resource?: LearningResource }) => {
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
    <Description
      /**
       * Resource descriptions can contain HTML. They are sanitized on the
       * backend during ETL. This is safe to render.
       */
      dangerouslySetInnerHTML={{ __html: resource.description || "" }}
    />
  )
}

const formatRunDate = (
  run: LearningResourceRun,
  asTaughtIn: boolean,
): string | null => {
  if (asTaughtIn) {
    const semester = capitalize(run.semester ?? "")
    if (semester && run.year) {
      return `${semester} ${run.year}`
    }
    if (semester && run.start_date) {
      return `${semester} ${formatDate(run.start_date, "YYYY")}`
    }
    if (run.start_date) {
      return formatDate(run.start_date, "MMMM, YYYY")
    }
  }
  if (run.start_date) {
    return formatDate(run.start_date, "MMMM DD, YYYY")
  }
  return null
}

const LearningResourceExpandedV1: React.FC<LearningResourceExpandedV1Props> = ({
  resource,
  titleId,
  user,
  imgConfig,
  inLearningPath,
  inUserList,
  onAddToLearningPathClick,
  onAddToUserListClick,
}) => {
  const [selectedRun, setSelectedRun] = useState(resource?.runs?.[0])

  const multipleRuns = resource?.runs && resource.runs.length > 1
  const asTaughtIn = resource ? showStartAnytime(resource) : false
  const label = asTaughtIn ? "As taught in:" : "Start Date:"

  useEffect(() => {
    if (resource) {
      const closest = resource?.runs?.reduce(function (prev, current) {
        const now = Date.now()
        return prev.start_date &&
          current.start_date &&
          Date.parse(prev.start_date) > now &&
          Date.parse(prev.start_date) - now <
            Date.parse(current.start_date) - now
          ? prev
          : current
      }, resource!.runs![0])
      setSelectedRun(closest)
    }
  }, [resource])

  const onDateChange: SimpleSelectProps["onChange"] = (event) => {
    const run = resource?.runs?.find(
      (run) => run.id === Number(event.target.value),
    )
    if (run) setSelectedRun(run)
  }

  const DateSection = ({ hide }: { hide?: boolean }) => {
    if (hide) {
      return null
    }
    if (!resource) {
      return <Skeleton height={40} style={{ marginTop: 0, width: "60%" }} />
    }

    const dateOptions: SimpleSelectProps["options"] =
      resource.runs
        ?.sort((a, b) => {
          if (a?.start_date && b?.start_date) {
            return Date.parse(a.start_date) - Date.parse(b.start_date)
          }
          return 0
        })
        .map((run) => {
          return {
            value: run.id.toString(),
            label: <NoSSR>{formatRunDate(run, asTaughtIn)}</NoSSR>,
          }
        }) ?? []

    if (
      [ResourceTypeEnum.Course, ResourceTypeEnum.Program].includes(
        resource.resource_type as "course" | "program",
      ) &&
      multipleRuns
    ) {
      return (
        <DateContainer>
          <DateLabel>{label}</DateLabel>
          <SimpleSelect
            value={selectedRun?.id.toString() ?? ""}
            onChange={onDateChange}
            options={dateOptions}
          />
        </DateContainer>
      )
    }

    if (!selectedRun) return <NoDateSpacer />

    const formatted = formatRunDate(selectedRun, asTaughtIn)
    if (!formatted) {
      return <NoDateSpacer />
    }
    return (
      <DateSingle>
        <DateLabel>{label}</DateLabel>
        <NoSSR>{formatted ?? ""}</NoSSR>
      </DateSingle>
    )
  }

  const isVideo =
    resource &&
    (resource.resource_type === ResourceTypeEnum.Video ||
      resource.resource_type === ResourceTypeEnum.VideoPlaylist)

  return (
    <Container padTop={isVideo}>
      <DateSection hide={isVideo} />
      <ImageSection resource={resource} config={imgConfig} />
      <CallToActionSection resource={resource} hide={isVideo} />
      <DetailSection titleId={titleId} resource={resource} />
      <InfoSectionV1
        resource={resource}
        run={selectedRun}
        user={user}
        inLearningPath={inLearningPath}
        inUserList={inUserList}
        onAddToLearningPathClick={onAddToLearningPathClick}
        onAddToUserListClick={onAddToUserListClick}
      />
    </Container>
  )
}

export { LearningResourceExpandedV1 }
export type { LearningResourceExpandedV1Props }
