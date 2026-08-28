import { env } from "@/env"
import { RESOURCE_DRAWER_PARAMS } from "@/common/urls"
import { parseResourceId } from "@/common/slugs"
import type { ServerSearchParam } from "@/common/searchParams"
import { htmlToPlainText } from "@/common/htmlToPlainText"
import type { AxiosError } from "axios"
import type { Metadata } from "next"
import * as Sentry from "@sentry/nextjs"
import { learningResourceQueries } from "api/hooks/learningResources"
import { notFound } from "next/navigation"
import { getQueryClient } from "@/app/getQueryClient"

const DEFAULT_OG_IMAGE = "/images/learn-og-image.jpg"

type MetadataAsyncProps = {
  title?: string
  description?: string
  image?: string
  imageAlt?: string
  searchParams?: Promise<Partial<Record<ServerSearchParam, string | string[]>>>
  social?: boolean
} & Metadata

/**
 * Throw inside safeGenerateMetadata to trigger a 404 not-found response.
 * Use this instead of Next.js's notFound(), which throws an internal error
 * that safeGenerateMetadata's catch block cannot intercept.
 */
export class MetadataNotFound extends Error {}

/**
 * Wraps the metadata generation function in a try/catch block. Uncaught or
 * rethrown errors in generateMetadata result in showing the fallback error page,
 * which is heavy handed for metadata generation errors.
 *
 * Axios error cannot be serialized as they contain function values and circular references.
 * These result in "Functions cannot be passed directly to Client Components" errors (in production build).
 *
 * Instead, we catch the error and return the fallback of default metadata.
 *
 * If the error is a 404, we show the not found page.
 */
export async function safeGenerateMetadata(
  fn: () => Promise<Metadata>,
): Promise<Metadata> {
  try {
    return await fn()
  } catch (error: unknown) {
    if (error instanceof MetadataNotFound) {
      return notFound()
    }
    if ((error as AxiosError)?.response?.status === 404) {
      return notFound()
    }
    console.error("Error fetching page metadata", error)
    Sentry.captureException(error)
    return standardizeMetadata()
  }
}

/*
 * Fetch metadata for the current page.
 * the method handles resource param override if necessary.
 */
export const getMetadataAsync = async ({
  title = "MIT Learn",
  description = "Learn with MIT",
  image = DEFAULT_OG_IMAGE,
  imageAlt,
  searchParams,
  social = true,
  alternates,
  ...otherMeta
}: MetadataAsyncProps) => {
  // The learning resource drawer is open. `resource` must be a bare positive
  // integer; a non-integer or repeated/array value opens no drawer and adds no
  // canonical override. The cosmetic resource_title is ignored.
  const rawResource = (await searchParams)?.[RESOURCE_DRAWER_PARAMS.resource]
  const learningResourceId = parseResourceId(rawResource)
  const alts = alternates ?? {}

  if (learningResourceId) {
    const queryClient = getQueryClient()
    const data = await queryClient.fetchQuery(
      learningResourceQueries.detail(learningResourceId),
    )
    title = data?.title
    description = data?.description ?? ""
    // Image and alt move together: taking the resource's image means taking its
    // alt, and falling back to the caller's image means keeping the caller's.
    if (data?.image?.url) {
      image = data.image.url
      imageAlt = data.image.alt || ""
    }
    /**
     * Canonicalize the drawer to the resource's location on Learn: its own page
     * where it has one, else this drawer URL itself. The backend owns the
     * choice, so the canonical here, the card hrefs, and the sitemap cannot
     * disagree.
     */
    alts.canonical = data.learn_url
  }

  return standardizeMetadata({
    title,
    description,
    image,
    imageAlt,
    social,
    alternates: alts,
    ...otherMeta,
  })
}

type MetadataProps = Omit<MetadataAsyncProps, "searchParams">

/*
 * Method that returns standardized metadata including
 * social tags for the current page
 */
export const standardizeMetadata = ({
  title = "MIT Learn",
  description = "Learn with MIT",
  image = DEFAULT_OG_IMAGE,
  imageAlt,
  social = true,
  ...otherMeta
}: MetadataProps = {}): Metadata => {
  title = `${title} | ${env("NEXT_PUBLIC_SITE_NAME")}`
  description = htmlToPlainText(description)
  const socialMetadata = social
    ? {
        openGraph: {
          title,
          description,
          siteName: env("NEXT_PUBLIC_SITE_NAME"),
          images: [
            {
              url: image,
              width: image === DEFAULT_OG_IMAGE ? 967 : "",
              height: image === DEFAULT_OG_IMAGE ? 511 : "",
              alt: imageAlt,
            },
          ],
          videos: [],
          locale: "en_US",
          type: "website",
        },
        twitter: {
          card: "summary_large_image",
          title,
          description,
          images: [image], // Must be an absolute URL
        },
      }
    : {}

  return {
    title,
    description,
    ...socialMetadata,
    robots:
      process.env.MITOL_NOINDEX === "false" ? undefined : "noindex, nofollow",
    ...otherMeta,
  }
}
