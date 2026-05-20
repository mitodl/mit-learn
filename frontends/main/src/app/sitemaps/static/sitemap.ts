import { env } from "@/env"
import type { MetadataRoute } from "next"
import invariant from "tiny-invariant"

invariant(env("NEXT_PUBLIC_ORIGIN"))
const BASE_URL: string = env("NEXT_PUBLIC_ORIGIN")

export default function sitemap(): MetadataRoute.Sitemap {
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
