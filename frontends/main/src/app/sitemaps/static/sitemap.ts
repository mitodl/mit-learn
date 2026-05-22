import { requiredEnv } from "@/env"
import type { MetadataRoute } from "next"
import { dangerouslyDetectProductionBuildPhase } from "../util"

/**
 * As of NextJS 15.5.3, metadata routes like sitemap.ts are ALWAYS executed at
 * build time even with force-dynamic (this may be a NextJS bug). We guard
 * against that here so requiredEnv() is not called before NEXT_PUBLIC_ORIGIN
 * is injected at runtime by Kubernetes.
 */
export const dynamic = "force-dynamic"

export default function sitemap(): MetadataRoute.Sitemap {
  if (dangerouslyDetectProductionBuildPhase()) return []
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
