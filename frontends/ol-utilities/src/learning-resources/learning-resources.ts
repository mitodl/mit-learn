import type { LearningResource, LearningResourceRun } from "api"
import { DeliveryEnum, ResourceTypeEnum } from "api"
import { capitalize } from "lodash"
import { formatDate } from "../date/utils"

const readableResourceTypes: Record<ResourceTypeEnum, string> = {
  [ResourceTypeEnum.Course]: "Course",
  [ResourceTypeEnum.Program]: "Program",
  [ResourceTypeEnum.Article]: "Article",
  [ResourceTypeEnum.LearningPath]: "Learning Path",
  [ResourceTypeEnum.Podcast]: "Podcast",
  [ResourceTypeEnum.PodcastEpisode]: "Podcast Episode",
  [ResourceTypeEnum.Video]: "Video",
  [ResourceTypeEnum.VideoPlaylist]: "Video Playlist",
  [ResourceTypeEnum.Document]: "Document",
}
const getReadableResourceType = (resourceType: ResourceTypeEnum): string =>
  readableResourceTypes[resourceType]

const BLANK_IMAGE = `${process.env.NEXT_PUBLIC_ORIGIN}/images/blank.png`

const embedlyCroppedImage = (
  url: string,
  { key, width, height }: EmbedlyConfig,
) => {
  if (!key) return url
  return `https://i.embed.ly/1/display/crop/?key=${key}&url=${encodeURIComponent(
    url,
  )}&height=${height}&width=${width}&grow=true&animate=false&errorurl=${BLANK_IMAGE}`
}

const DEFAULT_RESOURCE_IMG = "/images/default_resource.jpg"

type EmbedlyConfig = {
  key: string
  width: number
  height: number
}

const resourceThumbnailSrc = (
  image: LearningResource["image"],
  config: EmbedlyConfig,
) => embedlyCroppedImage(image?.url ?? DEFAULT_RESOURCE_IMG, config)

const formatRunDate = (
  run: LearningResourceRun,
  asTaughtIn: boolean,
  availability?: string | null,
  bestRunId?: number | null,
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

  // For the best run in dated resources, use special logic
  if (run.id === bestRunId && availability === "dated" && !asTaughtIn) {
    if (!run.start_date && !run.enrollment_start) return null

    // Get the max of start_date and enrollment_start
    let bestStart: string
    if (run.start_date && run.enrollment_start) {
      bestStart =
        Date.parse(run.start_date) > Date.parse(run.enrollment_start)
          ? run.start_date
          : run.enrollment_start
    } else {
      bestStart = (run.start_date || run.enrollment_start)!
    }

    // If the best start date is in the future, show it; otherwise show today
    const now = new Date()
    const bestStartDate = new Date(bestStart)
    if (bestStartDate > now) {
      return formatDate(bestStart, "MMMM DD, YYYY")
    } else {
      return formatDate(new Date().toISOString(), "MMMM DD, YYYY")
    }
  }

  if (run.start_date) {
    return formatDate(run.start_date, "MMMM DD, YYYY")
  }
  return null
}

/**
 * Checks if all runs of a given learning resource are identical in terms of price, delivery method, and location.
 *
 * @param resource - The learning resource to check.
 * @returns `true` if all runs have the same price, delivery method, and location; otherwise, `false`.
 */
const allRunsAreIdentical = (resource: LearningResource) => {
  if (!resource.runs) {
    return true
  }
  if (resource.runs.length <= 1) {
    return true
  }
  const prices = new Set<string>()
  const deliveryMethods = new Set<string>()
  const locations = new Set<string>()
  for (const run of resource.runs) {
    if (run.resource_prices) {
      const serialized = run.resource_prices
        .map((price) => `${Number(price.amount).toFixed(2)}-${price.currency}`)
        .join(":::")
      prices.add(serialized)
    }
    if (run.delivery) {
      for (const dm of run.delivery) {
        deliveryMethods.add(dm.code)
      }
    }
    if (run.location) {
      locations.add(run.location)
    }
  }
  const hasInPerson = [...deliveryMethods].some(
    (dm) => dm === DeliveryEnum.InPerson,
  )
  return (
    prices.size <= 1 &&
    deliveryMethods.size === 1 &&
    (hasInPerson ? locations.size === 1 : locations.size === 0)
  )
}

const getResourceLanguage = (resource: LearningResource) => {
  return resource.runs?.[resource.runs.length - 1]?.languages?.[0]
}

export {
  DEFAULT_RESOURCE_IMG,
  embedlyCroppedImage,
  resourceThumbnailSrc,
  getReadableResourceType,
  formatRunDate,
  allRunsAreIdentical,
  getResourceLanguage,
}
export type { EmbedlyConfig }
