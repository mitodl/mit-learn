import type { MetadataRoute } from "next"
import { getQueryClient } from "@/app/getQueryClient"
import { learningResourceQueries } from "api/hooks/learningResources"
import { PlatformEnum, ResourceTypeEnum } from "api"
import invariant from "tiny-invariant"
import { GenerateSitemapResult } from "../types"
import { dangerouslyDetectProductionBuildPhase } from "../util"

const BASE_URL = process.env.NEXT_PUBLIC_ORIGIN
invariant(BASE_URL, "NEXT_PUBLIC_ORIGIN must be defined")

const PAGE_SIZE = 1_000

export const dynamic = "force-dynamic"

export async function generateSitemaps(): Promise<GenerateSitemapResult[]> {
  if (dangerouslyDetectProductionBuildPhase()) return []

  const queryClient = getQueryClient()
  const { count } = await queryClient.fetchQuery(
    learningResourceQueries.summaryList({
      limit: PAGE_SIZE,
      platform: [PlatformEnum.Mitxonline],
      resource_type: [ResourceTypeEnum.Course, ResourceTypeEnum.Program],
    }),
  )

  const pages = Math.ceil(count / PAGE_SIZE)

  return new Array(pages).fill(null).map((_, index) => ({
    id: index,
    location: `${BASE_URL}/sitemaps/products/sitemap/${index}.xml`,
  }))
}

export default async function sitemap({
  id,
}: {
  id: string
}): Promise<MetadataRoute.Sitemap> {
  const queryClient = getQueryClient()
  const data = await queryClient.fetchQuery(
    learningResourceQueries.summaryList({
      limit: PAGE_SIZE,
      offset: +id * PAGE_SIZE,
      platform: [PlatformEnum.Mitxonline],
      resource_type: [ResourceTypeEnum.Course, ResourceTypeEnum.Program],
    }),
  )

  return data.results
    .filter((resource) => Boolean(resource.url))
    .map((resource) => ({
      url: resource.url as string,
      lastModified: resource.last_modified ?? undefined,
    }))
}
