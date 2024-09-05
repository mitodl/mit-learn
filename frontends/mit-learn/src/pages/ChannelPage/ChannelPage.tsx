import React from "react"
import { useParams } from "react-router"
import { ChannelPageTemplate } from "./ChannelPageTemplate"
import { useChannelDetail } from "api/hooks/channels"
import ChannelSearch from "./ChannelSearch"
import type {
  Facets,
  FacetKey,
  BooleanFacets,
} from "@mitodl/course-search-utils"
import { ChannelTypeEnum } from "api/v0"
import { useLearningResourceTopics } from "api/hooks/learningResources"
import { ChipLink, Container, styled, Typography } from "ol-components"

const SubTopicsContainer = styled(Container)(({ theme }) => ({
  paddingTop: "40px",
  [theme.breakpoints.down("md")]: {
    paddingTop: "24px",
  },
}))

const SubTopicsHeader = styled(Typography)(({ theme }) => ({
  marginBottom: "10px",
  ...theme.typography.subtitle1,
}))

const ChipsContainer = styled.div({
  display: "flex",
  flexWrap: "wrap",
  gap: "12px",
})

type RouteParams = {
  channelType: ChannelTypeEnum
  name: string
}

type SubTopicDisplayProps = {
  parentTopicId: number
}

const SubTopicsDisplay: React.FC<SubTopicDisplayProps> = (props) => {
  const { parentTopicId } = props
  const topicsQuery = useLearningResourceTopics({
    parent_topic_id: [parentTopicId],
  })
  const totalSubtopics = topicsQuery.data?.results?.length ?? 0
  return (
    totalSubtopics > 0 && (
      <SubTopicsContainer>
        <SubTopicsHeader>Related Topics</SubTopicsHeader>
        <ChipsContainer>
          {topicsQuery.data?.results.map((topic) => (
            <ChipLink
              size="large"
              variant="outlinedWhite"
              key={topic.id}
              href={topic.channel_url ? topic.channel_url : ""}
              label={topic.name}
            />
          ))}
        </ChipsContainer>
      </SubTopicsContainer>
    )
  )
}

const ChannelPage: React.FC = () => {
  const { channelType, name } = useParams<RouteParams>()
  const channelQuery = useChannelDetail(String(channelType), String(name))
  const searchParams: Facets & BooleanFacets = {}
  const publicDescription = channelQuery.data?.public_description

  if (channelQuery.data?.search_filter) {
    const urlParams = new URLSearchParams(channelQuery.data.search_filter)
    for (const [key, value] of urlParams.entries()) {
      const paramEntry = searchParams[key as FacetKey]
      if (paramEntry !== undefined) {
        paramEntry.push(value)
      } else {
        searchParams[key as FacetKey] = [value]
      }
    }
  }

  return (
    name &&
    channelType && (
      <>
        <ChannelPageTemplate name={name} channelType={channelType}>
          {publicDescription && (
            <Typography variant="body1">{publicDescription}</Typography>
          )}
          {channelQuery.data?.channel_type === ChannelTypeEnum.Topic &&
          channelQuery.data?.topic_detail?.topic ? (
            <SubTopicsDisplay
              parentTopicId={channelQuery.data?.topic_detail?.topic}
            />
          ) : null}
          {channelQuery.data?.search_filter && (
            <ChannelSearch
              channelTitle={channelQuery.data.title}
              constantSearchParams={searchParams}
              channelType={channelType}
            />
          )}
        </ChannelPageTemplate>
      </>
    )
  )
}

export default ChannelPage
