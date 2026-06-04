"use client"

import { env } from "@/env"
import React, { useCallback, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import { LinkAdapter, styled } from "ol-components"
import { styled as smootStyled } from "@mitodl/smoot-design"
import { RiSparkling2Line } from "@remixicon/react"
import { useFeatureFlagEnabled, usePostHog } from "posthog-js/react"
import { LearningResource, ResourceTypeEnum } from "api"
import {
  useLearningResourceByReadableId,
  useLearningResourceDetailSetCache,
} from "api/hooks/learningResources"
import { FeatureFlags } from "@/common/feature_flags"
import { PostHogEvents } from "@/common/constants"
import { RESOURCE_DRAWER_PARAMS } from "@/common/urls"
import { isSyllabusChatEnabled } from "@/page-components/AiChat/syllabusChatConfig"

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

const AskTimLabel = styled.span(({ theme }) => ({
  ...theme.typography.body1,
  fontSize: "16px",
  lineHeight: "18px",
  color: theme.custom.colors.darkGray2,
  strong: {
    ...theme.typography.subtitle1,
    fontSize: "16px",
    lineHeight: "18px",
  },
}))

const expectedResourceType = (resourceType: "course" | "program") =>
  resourceType === "course" ? ResourceTypeEnum.Course : ResourceTypeEnum.Program

type ProductPageAskTimButtonProps = {
  resource: LearningResource
}

export const ProductPageAskTimButton: React.FC<
  ProductPageAskTimButtonProps
> = ({ resource }) => {
  const posthog = usePostHog()
  const searchParams = useSearchParams()
  const seedDetailCache = useLearningResourceDetailSetCache(resource)
  const categoryLabel = resource.resource_category.toLowerCase()

  const syllabusHref = useMemo(() => {
    const params = new URLSearchParams(searchParams)
    params.set(RESOURCE_DRAWER_PARAMS.resource, String(resource.id))
    params.set(RESOURCE_DRAWER_PARAMS.syllabus, "")
    params.set(RESOURCE_DRAWER_PARAMS.syllabusOnly, "")
    return `?${params.toString()}`
  }, [searchParams, resource.id])

  const onClick = useCallback(() => {
    seedDetailCache()
    if (env("NEXT_PUBLIC_POSTHOG_API_KEY")) {
      posthog.capture(PostHogEvents.AskTimClicked, {
        type: "syllabus_bot",
        resourceId: resource.id,
        readableId: resource.readable_id,
        resourceType: resource.resource_type,
        platformCode: resource.platform?.code,
      })
    }
  }, [posthog, resource, seedDetailCache])

  return (
    <AskTimCard>
      <AskTimLink shallow href={syllabusHref} onClick={onClick}>
        <RiSparkling2Line aria-hidden />
        <AskTimLabel>
          Ask <strong>TIM</strong>
          {` about this ${categoryLabel}`}
        </AskTimLabel>
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
  const courseChatEnabled = useFeatureFlagEnabled(FeatureFlags.LrDrawerChatbot)
  const programChatEnabled = useFeatureFlagEnabled(FeatureFlags.PrDrawerChatbot)
  const flagEnabled =
    resourceType === "course" ? courseChatEnabled : programChatEnabled
  const chatEnabledForType = isSyllabusChatEnabled() && !!flagEnabled

  const { data: resource, isSuccess } = useLearningResourceByReadableId(
    readableId,
    { enabled: chatEnabledForType },
  )

  if (!chatEnabledForType || !isSuccess || !resource) {
    return null
  }
  if (resource.resource_type !== expectedResourceType(resourceType)) {
    return null
  }

  return <ProductPageAskTimButton resource={resource} />
}
