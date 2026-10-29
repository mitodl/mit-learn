import type { ResourceCarouselProps } from "@/page-components/ResourceCarousel/ResourceCarousel"
import {
  FeaturedListOfferedByEnum,
  type FeaturedApiFeaturedListRequest as FeaturedListParams,
} from "api"

// Sloan and Professional Education featured items show on their own channel pages only
const HOME_EXCLUDED_OFFERORS: FeaturedListOfferedByEnum[] = ["see", "mitpe"]

export const FEATURED_COMMON_PARAMS: FeaturedListParams = {
  limit: 12,
  offered_by: Object.values(FeaturedListOfferedByEnum).filter(
    (offeror) => !HOME_EXCLUDED_OFFERORS.includes(offeror),
  ),
}
const FEATURED_RESOURCES_CAROUSEL: ResourceCarouselProps["config"] = [
  {
    label: "All",
    cardProps: { size: "medium" },
    data: {
      type: "lr_featured",
      params: { ...FEATURED_COMMON_PARAMS },
    },
  },
  {
    label: "Free",
    cardProps: { size: "medium" },
    data: {
      type: "lr_featured",
      params: { ...FEATURED_COMMON_PARAMS, free: true },
    },
  },
  {
    label: "With Certificate",
    cardProps: { size: "medium" },
    data: {
      type: "lr_featured",
      params: {
        ...FEATURED_COMMON_PARAMS,
        certification: true,
        professional: false,
      },
    },
  },
  {
    label: "Professional & Executive Learning",
    cardProps: { size: "medium" },
    data: {
      type: "lr_featured",
      params: { ...FEATURED_COMMON_PARAMS, professional: true },
    },
  },
]

const MEDIA_CAROUSEL: ResourceCarouselProps["config"] = [
  {
    label: "All",
    cardProps: { size: "small", isMedia: true },
    data: {
      type: "resources",
      params: {
        resource_type: ["video", "podcast_episode"],
        limit: 12,
        sortby: "new",
      },
    },
  },
  {
    label: "Videos",
    cardProps: { size: "small", isMedia: true },
    data: {
      type: "resources",
      params: { resource_type: ["video"], limit: 12, sortby: "new" },
    },
  },
  {
    label: "Podcasts",
    cardProps: { size: "small", isMedia: true },
    data: {
      type: "resources",
      params: { resource_type: ["podcast_episode"], limit: 12, sortby: "new" },
    },
  },
]

const VIDEO_SHORTS_CAROUSEL: ResourceCarouselProps["config"] = [
  {
    label: "Videos",
    cardProps: { size: "small", isMedia: true },
    data: {
      type: "resources",
      params: { resource_type: ["video"], limit: 12, sortby: "new" },
    },
  },
]

export { FEATURED_RESOURCES_CAROUSEL, MEDIA_CAROUSEL, VIDEO_SHORTS_CAROUSEL }
