import { requiredEnv } from "@/env"
import type { MetadataRoute } from "next"

export default function sitemap(): MetadataRoute.Sitemap {
  const BASE_URL = requiredEnv("NEXT_PUBLIC_ORIGIN")
  return [
    {
      url: BASE_URL,
    },
    {
      url: `${BASE_URL}/search`,
    },
    {
      url: `${BASE_URL}/about`,
    },
    {
      url: `${BASE_URL}/topics`,
    },
    {
      url: `${BASE_URL}/departments`,
    },
    {
      url: `${BASE_URL}/units`,
    },
  ]
}
