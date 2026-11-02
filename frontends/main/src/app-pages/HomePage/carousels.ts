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
    size: "medium",
    data: {
      type: "lr_featured",
      params: { ...FEATURED_COMMON_PARAMS },
    },
  },
  {
    label: "Free",
    size: "medium",
    data: {
      type: "lr_featured",
      params: { ...FEATURED_COMMON_PARAMS, free: true },
    },
  },
  {
    label: "With Certificate",
    size: "medium",
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
    size: "medium",
    data: {
      type: "lr_featured",
      params: { ...FEATURED_COMMON_PARAMS, professional: true },
    },
  },
]

export { FEATURED_RESOURCES_CAROUSEL }
