import React, { useEffect } from "react"
import { RoutedDrawer, ExpandedLearningResourceDisplay } from "ol-components"
import type { RoutedDrawerProps } from "ol-components"
import { useLearningResourcesDetail } from "api/hooks/learningResources"
import { imgConfigs } from "@/common/constants"
import { useSearchParams } from "react-router-dom"
import { RESOURCE_DRAWER_QUERY_PARAM } from "@/common/urls"
import { usePostHog } from "posthog-js/react"

const RESOURCE_DRAWER_PARAMS = [RESOURCE_DRAWER_QUERY_PARAM] as const

const useCapturePageView = (resourceId: number) => {
  const { data, isSuccess } = useLearningResourcesDetail(Number(resourceId))
  const posthog = usePostHog()

  useEffect(() => {
    if (!APP_SETTINGS.posthog?.enabled) return
    if (!isSuccess) return
    console.log("making posthog capture")
    posthog.capture("lrd_view", {
      resourceId: data?.id || "unknown",
      readableId: data?.readable_id,
      platformCode: data?.platform?.code,
      resourceType: data?.resource_type,
    })
  }, [
    isSuccess,
    posthog,
    data?.id,
    data?.readable_id,
    data?.platform?.code,
    data?.resource_type,
  ])
}

const DrawerContent: React.FC<{
  resourceId: number
  isOpen: boolean
}> = ({ resourceId, isOpen }) => {
  const resource = useLearningResourcesDetail(Number(resourceId))
  useCapturePageView(Number(resourceId), isOpen)

  return (
    <ExpandedLearningResourceDisplay
      imgConfig={imgConfigs.large}
      resource={resource.data}
    />
  )
}

const PAPER_PROPS: RoutedDrawerProps["PaperProps"] = {
  sx: {
    padding: "1rem",
    maxWidth: (theme) => `${theme.breakpoints.values.sm}px`,
  },
}

const LearningResourceDrawer = () => {
  return (
    <RoutedDrawer
      anchor="right"
      requiredParams={RESOURCE_DRAWER_PARAMS}
      PaperProps={PAPER_PROPS}
    >
      {({ params, open }) => {
        return (
          <>
            <DrawerContent resourceId={Number(params.resource)} isOpen={open} />
          </>
        )
      }}
    </RoutedDrawer>
  )
}

const useOpenLearningResourceDrawer = () => {
  const [_searchParams, setSearchParams] = useSearchParams()
  const openLearningResourceDrawer = React.useCallback(
    (resourceId: number) => {
      setSearchParams((current) => {
        const copy = new URLSearchParams(current)
        copy.set(RESOURCE_DRAWER_QUERY_PARAM, resourceId.toString())
        return copy
      })
    },
    [setSearchParams],
  )
  return openLearningResourceDrawer
}

export default LearningResourceDrawer
export { useOpenLearningResourceDrawer }
