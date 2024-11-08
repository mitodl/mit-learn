import moment from "moment"
import type {
  LearningResource,
  LearningResourcePrice,
  LearningResourceRun,
} from "api"
import { ResourceTypeEnum } from "api"
import { capitalize } from "lodash"
import { formatDate } from "../date/format"

const readableResourceTypes: Record<ResourceTypeEnum, string> = {
  [ResourceTypeEnum.Course]: "Course",
  [ResourceTypeEnum.Program]: "Program",
  [ResourceTypeEnum.LearningPath]: "Learning Path",
  [ResourceTypeEnum.Podcast]: "Podcast",
  [ResourceTypeEnum.PodcastEpisode]: "Podcast Episode",
  [ResourceTypeEnum.Video]: "Video",
  [ResourceTypeEnum.VideoPlaylist]: "Video Playlist",
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

const DATE_FORMAT = "YYYY-MM-DD[T]HH:mm:ss[Z]"
/**
 * Parse date string into a moment object.
 *
 * If date is null or undefined, a Moment<Invalid date> object is returned.
 * Invalid dates return false for all comparisons.
 */
const asMoment = (date?: string | null) => moment(date, DATE_FORMAT)
const isCurrent = (run: LearningResourceRun) =>
  asMoment(run.start_date).isSameOrBefore() && asMoment(run.end_date).isAfter()

/**
 * Sort dates descending, with invalid dates last.
 */
const datesDescendingSort = (
  aString: string | null | undefined,
  bString: string | null | undefined,
) => {
  const a = asMoment(aString)
  const b = asMoment(bString)
  // if both invalid, tie
  if (!a.isValid() && !b.isValid()) return 0
  // if only one invalid, the other is better
  if (!a.isValid()) return 1
  if (!b.isValid()) return -1
  // if both valid, sort descending
  return -a.diff(b)
}

/**
 * Find "best" running: prefer current, then nearest future, then nearest past.
 */
const findBestRun = (
  runs: LearningResourceRun[],
): LearningResourceRun | undefined => {
  const sorted = runs.sort((a, b) =>
    datesDescendingSort(a.start_date, b.start_date),
  )

  const current = sorted.find(isCurrent)
  if (current) return current

  // Closest to now will be last in the sorted array
  const future = sorted.filter((run) =>
    asMoment(run.start_date).isSameOrAfter(),
  )
  if (future.length > 0) return future[future.length - 1]

  // Closest to now will be first in the sorted array
  const past = sorted.filter((run) => asMoment(run.start_date).isBefore())
  return past[0] ?? sorted[0]
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

/**
 * Checks if all runs of a given learning resource are identical in terms of price, delivery method, and location.
 *
 * @param resource - The learning resource to check.
 * @returns `true` if all runs have the same price, delivery method, and location; otherwise, `false`.
 */
const allRunsAreIdentical = (resource: LearningResource) => {
  if (!resource.runs) {
    return false
  }
  if (resource.runs.length === 1) {
    return false
  }
  const prices: LearningResourcePrice[] = []
  const deliveryMethods = []
  const locations = []
  for (const run of resource.runs) {
    if (run.resource_prices) {
      run.resource_prices.forEach((price) => {
        if (price.amount !== "0") {
          prices.push(price)
        }
      })
    }
    if (run.delivery) {
      deliveryMethods.push(run.delivery)
    }
    if (run.location) {
      locations.push(run.location)
    }
  }
  const distinctPrices = [...new Set(prices.map((p) => p.amount).flat())]
  const distinctDeliveryMethods = [
    ...new Set(deliveryMethods.flat().map((dm) => dm?.code)),
  ]
  const distinctLocations = [...new Set(locations.flat().map((l) => l))]
  return (
    distinctPrices.length === 1 &&
    distinctDeliveryMethods.length === 1 &&
    distinctLocations.length === 1
  )
}

export {
  DEFAULT_RESOURCE_IMG,
  embedlyCroppedImage,
  resourceThumbnailSrc,
  getReadableResourceType,
  findBestRun,
  formatRunDate,
  allRunsAreIdentical,
}
export type { EmbedlyConfig }
