import { RESOURCE_DRAWER_QUERY_PARAM } from "@/common/urls"
import { learningResourcesApi } from "api/clients"
import type { Metadata } from "next"

const DEFAULT_OG_IMAGE = "/images/learn-og-image.jpg"

type MetadataAsyncProps = {
  title?: string
  description?: string
  image?: string
  imageAlt?: string
  searchParams?: { [key: string]: string | string[] | undefined }
  social?: boolean
} & Metadata

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
  ...otherMeta
}: MetadataAsyncProps) => {
  // The learning resource drawer is open
  const learningResourceId = searchParams?.[RESOURCE_DRAWER_QUERY_PARAM]
  if (learningResourceId) {
    try {
      const { data } = await learningResourcesApi.learningResourcesRetrieve({
        id: Number(learningResourceId),
      })

      title = data?.title
      description = data?.description?.replace(/<\/[^>]+(>|$)/g, "") ?? ""
      image = data?.image?.url || image
      imageAlt = image === data?.image?.url ? imageAlt : data?.image?.alt || ""
    } catch (error) {
      console.warn("Failed to fetch learning resource", {
        learningResourceId,
        error,
      })
    }
  }

  return standardizeMetadata({
    title,
    description,
    image,
    imageAlt,
    social,
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
}: MetadataProps): Metadata => {
  title = `${title} | ${process.env.NEXT_PUBLIC_SITE_NAME}`
  const socialMetadata = social
    ? {
        openGraph: {
          title,
          description,
          siteName: process.env.NEXT_PUBLIC_SITE_NAME,
          images: [
            {
              url: image,
              width: image === DEFAULT_OG_IMAGE ? "" : 967,
              height: image === DEFAULT_OG_IMAGE ? "" : 511,
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