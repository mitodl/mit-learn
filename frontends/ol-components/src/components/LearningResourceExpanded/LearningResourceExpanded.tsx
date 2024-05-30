import React, { useEffect, useState } from "react"
import styled from "@emotion/styled"
import Skeleton from "@mui/material/Skeleton"
import Typography from "@mui/material/Typography"
import { ButtonLink } from "../Button/Button"
import MenuItem from "@mui/material/MenuItem"
import Chip from "@mui/material/Chip"
import type { LearningResource, LearningResourceTopic } from "api"
import { ResourceTypeEnum, PlatformEnum } from "api"
import {
  formatDate,
  resourceThumbnailSrc,
  getReadableResourceType,
} from "ol-utilities"
import type { EmbedlyConfig } from "ol-utilities"
import type { SelectChangeEvent } from "@mui/material/Select"
import { theme } from "../ThemeProvider/ThemeProvider"
import { SelectField } from "../SelectField/SelectField"
import { EmbedlyCard } from "../EmbedlyCard/EmbedlyCard"
import { PlatformLogo, PLATFORMS } from "../Logo/Logo"
import { ChipLink } from "../Chips/ChipLink"
import InfoSection from "./InfoSection"

const Container = styled.div<{ padTop?: boolean }>`
  display: flex;
  flex-direction: column;
  padding: 18px 32px 160px;
  gap: 20px;
  ${({ padTop }) => (padTop ? "padding-top: 64px;" : "")}
  width: 600px;
  ${({ theme }) => theme.breakpoints.down("md")} {
    width: 550px;
  }
  ${({ theme }) => theme.breakpoints.down("sm")} {
    width: auto;
  }
`

const Date = styled.div`
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

const DateSingle = styled(Date)`
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

const Image = styled.img<{ aspect: number }>`
  aspect-ratio: ${({ aspect }) => aspect};
  border-radius: 8px;
  width: 100%;
`

const SkeletonImage = styled(Skeleton)<{ aspect: number }>`
  border-radius: 8px;
  padding-bottom: ${({ aspect }) => 100 / aspect}%;
`

const CallToAction = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`

const StyledButton = styled(ButtonLink)`
  text-align: center;
  width: 220px;
  ${({ theme }) => theme.breakpoints.down("sm")} {
    width: 182px;
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
`

const OnPlatform = styled.span`
  ${{ ...theme.typography.body2 }}
  color: ${theme.custom.colors.black};
`

const Topics = styled.section`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const TopicsList = styled.ul`
  display: flex;
  flex-wrap: wrap;
  padding: 0;
  margin: 0;
  gap: 8px;
`

type LearningResourceExpandedProps = {
  resource?: LearningResource
  imgConfig: EmbedlyConfig
}

const ImageSection: React.FC<{
  resource?: LearningResource
  config: EmbedlyConfig
}> = ({ resource, config }) => {
  if (resource?.resource_type === "video" && resource?.url) {
    return (
      <EmbedlyCard
        aspectRatio={config.width / config.height}
        url={resource?.url}
        embedlyKey={config.key}
      />
    )
  } else if (resource?.image) {
    return (
      <Image
        src={resourceThumbnailSrc(resource?.image, config)}
        aspect={config.width / config.height}
        alt={resource?.image.alt ?? ""}
      />
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

  const platformImage =
    PLATFORMS[resource?.platform?.code as PlatformEnum]?.image

  const { resource_type: type, url, platform } = resource!

  const buttonPrefix =
    type === ResourceTypeEnum.Podcast ||
    type === ResourceTypeEnum.PodcastEpisode
      ? "Listen to"
      : "Take"

  return (
    <CallToAction>
      <StyledButton size="large" href={url!}>
        {`${buttonPrefix} ${getReadableResourceType(type)}`}
      </StyledButton>
      {platformImage ? (
        <Platform>
          <OnPlatform>on</OnPlatform>
          <StyledPlatformLogo platformCode={platform?.code as PlatformEnum} />
        </Platform>
      ) : null}
    </CallToAction>
  )
}

const DetailSection = ({ resource }: { resource?: LearningResource }) => {
  return (
    <Detail>
      <ResourceTitle resource={resource} />
      <ResourceDescription resource={resource} />
    </Detail>
  )
}

const ResourceTitle = ({ resource }: { resource?: LearningResource }) => {
  if (!resource) {
    return <Skeleton variant="text" height={20} width="66%" />
  }
  return (
    <Typography variant="h5" component="h2">
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
      dangerouslySetInnerHTML={{ __html: resource.description || "" }}
    />
  )
}

const TopicsSection: React.FC<{ topics?: LearningResourceTopic[] }> = ({
  topics,
}) => {
  if (!topics) {
    return null
  }
  return (
    <Topics>
      <Typography variant="subtitle2" component="h3">
        Topics
      </Typography>
      <TopicsList>
        {topics.map((topic) =>
          topic.channel_url ? (
            <ChipLink
              key={topic.id}
              size="medium"
              label={topic.name}
              href={topic.channel_url}
              variant="outlined"
            />
          ) : (
            <Chip
              key={topic.id}
              size="medium"
              label={topic.name}
              variant="outlined"
            />
          ),
        )}
      </TopicsList>
    </Topics>
  )
}

const LearningResourceExpanded: React.FC<LearningResourceExpandedProps> = ({
  resource,
  imgConfig,
}) => {
  const [selectedRun, setSelectedRun] = useState(resource?.runs?.[0])

  const multipleRuns = resource?.runs && resource.runs.length > 1

  useEffect(() => {
    if (resource) {
      setSelectedRun(resource!.runs![0])
    }
  }, [resource])

  const onDateChange = (event: SelectChangeEvent) => {
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

    if (
      [ResourceTypeEnum.Course, ResourceTypeEnum.Program].includes(
        resource.resource_type as "course" | "program",
      ) &&
      multipleRuns
    ) {
      return (
        <Date>
          <DateLabel>Start Date:</DateLabel>
          <SelectField
            label={null}
            value={selectedRun?.id as unknown as string}
            onChange={onDateChange}
          >
            {resource.runs?.map((run) => (
              <MenuItem key={run.id} value={run.id}>
                {formatDate(run.start_date!, "MMMM DD, YYYY")}
              </MenuItem>
            ))}
          </SelectField>
        </Date>
      )
    }

    const isOcw =
      resource.resource_type === ResourceTypeEnum.Course &&
      resource.platform?.code === PlatformEnum.Ocw

    const nextStart = resource.next_start_date || selectedRun?.start_date

    if (!isOcw && !nextStart && !(selectedRun?.semester && selectedRun?.year)) {
      return <NoDateSpacer />
    }

    return (
      <DateSingle>
        <DateLabel>{isOcw ? "As taught in:" : "Start Date:"}</DateLabel>
        {isOcw
          ? `${selectedRun?.semester} ${selectedRun?.year}`
          : formatDate(nextStart!, "MMMM DD, YYYY")}
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
      <DetailSection resource={resource} />
      <TopicsSection topics={resource?.topics} />
      <InfoSection resource={resource} run={selectedRun} />
    </Container>
  )
}

export { LearningResourceExpanded }
export type { LearningResourceExpandedProps }
