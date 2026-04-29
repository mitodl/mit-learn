import React from "react"
import type { LearningResourceTopic } from "api/v1"
import * as Styled from "./VideoSeriesDetailPage.styled"

type TopicChipsProps = {
  topics: LearningResourceTopic[]
}

const TopicChips: React.FC<TopicChipsProps> = ({ topics }) => {
  if (topics.length === 0) return null

  return (
    <>
      <Styled.SectionDivider />
      <Styled.VideoSeriesSectionHeading>
        Video Series
      </Styled.VideoSeriesSectionHeading>
      <Styled.TopicChipsRow>
        {topics.map((topic) => (
          <Styled.TopicChip
            key={topic.id}
            href={`/search?topic=${encodeURIComponent(topic.name ?? "")}`}
          >
            {topic.name}
          </Styled.TopicChip>
        ))}
      </Styled.TopicChipsRow>
    </>
  )
}

export default TopicChips
