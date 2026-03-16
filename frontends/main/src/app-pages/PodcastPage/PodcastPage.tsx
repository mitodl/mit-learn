"use client"

import React from "react"
import PodcastPageTemplate from "./PodcastPageTemplate"
import { useLearningResourcesList } from "api/hooks/learningResources"
import { LearningResource, PodcastEpisodeResource } from "api"

const PodcastPage: React.FC = () => {
  const { data: episodesData } = useLearningResourcesList({
    resource_type: ["podcast_episode"],
    limit: 4,
    sortby: "new",
  })

  const { data: podcastsData } = useLearningResourcesList({
    resource_type: ["podcast"],
    limit: 15,
    sortby: "new",
  })

  const episodes = (episodesData?.results ?? []) as PodcastEpisodeResource[]
  const podcasts = (podcastsData?.results ?? []) as LearningResource[]

  return <PodcastPageTemplate episodes={episodes} podcasts={podcasts} />
}

export default PodcastPage
