import type { MetadataRoute } from "next"
import { channelsApi } from "api/clients"
import invariant from "tiny-invariant"
import type { GenerateSitemapResult } from "../types"

const BASE_URL = process.env.NEXT_PUBLIC_ORIGIN
invariant(BASE_URL, "NEXT_PUBLIC_ORIGIN must be defined")

const TRY_FOR_PAGE_SIZE = 100

export async function generateSitemaps(): Promise<GenerateSitemapResult[]> {
  const { count, results } = (
    await channelsApi.channelsList({ limit: TRY_FOR_PAGE_SIZE })
  ).data
  // In case api has a lower limit than PAGE_SIZE, calculate the page size based on the results
  const pageSize = results.length
  const pages = Math.ceil(count / pageSize)
  return new Array(pages).fill(null).map((_, index) => ({
    id: index,
    limit: pageSize,
    offset: index * pageSize,
    location: `${BASE_URL}/sitemaps/channels/sitemap/${index}.xml`,
  }))
}

export default async function sitemap({
  limit,
  offset,
}: GenerateSitemapResult): Promise<MetadataRoute.Sitemap> {
  const { data } = await channelsApi.channelsList({
    limit,
    offset,
  })

  return data.results.map((channel) => ({
    url: `${BASE_URL}/c/${channel.channel_type}/${channel.name}`,
    changeFrequency: "monthly",
  }))
}
