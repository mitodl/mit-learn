"use client"

import { env } from "@/env"
import React, { useCallback, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import { LinkAdapter, styled } from "ol-components"
import { styled as smootStyled } from "@mitodl/smoot-design"
import { RiSparkling2Line } from "@remixicon/react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useFeatureFlagEnabled, usePostHog } from "posthog-js/react"
import { LearningResource, ResourceTypeEnum } from "api"
import {
  learningResourceQueries,
  learningResourceKeys,
} from "api/hooks/learningResources"
import { FeatureFlags } from "@/common/feature_flags"
import { PostHogEvents } from "@/common/constants"
import { RESOURCE_DRAWER_PARAMS } from "@/common/urls"
import { isSyllabusChatEnabled } from "@/page-components/AiChat/syllabusChatConfig"

/** AskTim-Updated card — MIT Design System product page (desktop full-width; tablet 320px). */
const AskTimCard = styled.div(({ theme }) => ({
  width: "100%",
  padding: "16px",
  borderRadius: "4px",
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  backgroundColor: theme.custom.colors.white,
  boxShadow: "0 4px 4px 0 rgba(19, 20, 21, 0.08)",
  boxSizing: "border-box",
  [theme.breakpoints.between("sm", "md")]: {
    width: "320px",
    maxWidth: "100%",
  },
}))

const AskTimLink = smootStyled(LinkAdapter)(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  width: "100%",
  textDecoration: "none",
  color: theme.custom.colors.darkGray2,
  backgroundColor: "transparent",
  border: "none",
  boxSizing: "border-box",
  "svg:first-child": {
    fill: theme.custom.colors.lightRed,
    width: "20px",
    height: "20px",
    flexShrink: 0,
  },
  "&:hover": {
    color: theme.custom.colors.darkGray2,
    backgroundColor: "transparent",
  },
}))

const AskTimText = styled.span({
  display: "inline",
  whiteSpace: "pre",
})

const AskWord = styled.span(({ theme }) => ({
  ...theme.typography.body2,
  color: theme.custom.colors.darkGray2,
}))

const TimWord = styled.span(({ theme }) => ({
  ...theme.typography.subtitle1,
  fontSize: "16px",
  lineHeight: "18px",
  color: theme.custom.colors.darkGray2,
}))

const AboutWord = styled.span(({ theme }) => ({
  ...theme.typography.body1,
  fontSize: "16px",
  lineHeight: "18px",
  color: theme.custom.colors.darkGray2,
}))

export const useLearningResourceByReadableId = (readableId: string) =>
  useQuery(learningResourceQueries.byReadableId(readableId))

const useProductPageAskTimVisible = (
  resource: LearningResource | null | undefined,
  resourceType: "course" | "program",
) => {
  const courseChatEnabled = useFeatureFlagEnabled(FeatureFlags.LrDrawerChatbot)
  const programChatEnabled = useFeatureFlagEnabled(FeatureFlags.PrDrawerChatbot)

  if (!isSyllabusChatEnabled() || !resource) {
    return false
  }

  if (resourceType === "course") {
    return (
      courseChatEnabled && resource.resource_type === ResourceTypeEnum.Course
    )
  }

  return (
    programChatEnabled && resource.resource_type === ResourceTypeEnum.Program
  )
}

type ProductPageAskTimButtonProps = {
  resource: LearningResource
}

export const ProductPageAskTimButton: React.FC<
  ProductPageAskTimButtonProps
> = ({ resource }) => {
  const posthog = usePostHog()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const categoryLabel = resource.resource_category.toLowerCase()

  const syllabusHref = useMemo(() => {
    const params = new URLSearchParams(searchParams)
    params.set(RESOURCE_DRAWER_PARAMS.resource, String(resource.id))
    params.set(RESOURCE_DRAWER_PARAMS.syllabus, "")
    return `?${params.toString()}`
  }, [searchParams, resource.id])

  const onClick = useCallback(() => {
    queryClient.setQueryData(learningResourceKeys.detail(resource.id), resource)
    if (env("NEXT_PUBLIC_POSTHOG_API_KEY")) {
      posthog.capture(PostHogEvents.AskTimClicked, {
        type: "syllabus_bot",
        resourceId: resource.id,
        readableId: resource.readable_id,
        resourceType: resource.resource_type,
        platformCode: resource.platform?.code,
      })
    }
  }, [posthog, queryClient, resource])

  return (
    <AskTimCard>
      <AskTimLink shallow href={syllabusHref} onClick={onClick}>
        <RiSparkling2Line aria-hidden />
        <AskTimText>
          <AskWord>Ask</AskWord>
          <TimWord>TIM</TimWord>
          <AboutWord>{` about this ${categoryLabel}`}</AboutWord>
        </AskTimText>
      </AskTimLink>
    </AskTimCard>
  )
}

type ProductPageAskTimSectionProps = {
  readableId: string
  resourceType: "course" | "program"
}

export const ProductPageAskTimSection: React.FC<
  ProductPageAskTimSectionProps
> = ({ readableId, resourceType }) => {
  const { data: resource, isFetched } =
    useLearningResourceByReadableId(readableId)
  const visible = useProductPageAskTimVisible(resource, resourceType)

  if (!isFetched || !visible || !resource) {
    return null
  }

  return <ProductPageAskTimButton resource={resource} />
}
