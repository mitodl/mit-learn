import { faker } from "@faker-js/faker/locale/en"
import { generateSitemaps, default as sitemap } from "./sitemap"
import { setMockResponse, urls, factories } from "api/test-utils"
import { ResourceTypeEnum } from "api"
import { videoDetailPageView, videoPlaylistPageView } from "@/common/urls"

const RESOURCE_TYPES = [ResourceTypeEnum.Video, ResourceTypeEnum.VideoPlaylist]

describe("Video Sitemaps", () => {
  it("returns expected sitemap params", async () => {
    const pages = faker.number.int({ min: 4, max: 6 })
    const summaries = factories.learningResources.resourceSummaries({
      count: pages * 1_000 - 350,
      pageSize: 1,
    })

    setMockResponse.get(
      urls.learningResources.summaryList({
        limit: 1,
        resource_type: RESOURCE_TYPES,
      }),
      summaries,
    )

    const result = await generateSitemaps()
    expect(result).toHaveLength(pages)
    expect(result).toEqual(
      new Array(pages).fill(null).map((_, index) => ({
        id: index,
        location: `http://test.learn.odl.local:8062/sitemaps/video/sitemap/${index}.xml`,
      })),
    )
  })

  it("generates expected URLs for video and video playlist resources", async () => {
    const page = faker.number.int({ min: 5, max: 10 })
    const playlistId = faker.number.int()
    const otherPlaylistId = faker.number.int()
    // A video in several playlists is addressed by its first, matching the
    // canonical tag and the bare-URL redirect on the video page.
    const videoWithPlaylists = factories.learningResources.resourceSummary({
      resource_type: ResourceTypeEnum.Video,
      canonical_parent_ids: [playlistId, otherPlaylistId],
    })
    const videoWithoutPlaylist = factories.learningResources.resourceSummary({
      resource_type: ResourceTypeEnum.Video,
    })
    const playlist = factories.learningResources.resourceSummary({
      resource_type: ResourceTypeEnum.VideoPlaylist,
    })
    const results = [videoWithPlaylists, videoWithoutPlaylist, playlist]

    setMockResponse.get(
      urls.learningResources.summaryList({
        limit: 1_000,
        offset: page * 1_000,
        resource_type: RESOURCE_TYPES,
      }),
      { count: results.length, next: null, previous: null, results },
    )

    const sitemapPage = await sitemap({ id: Promise.resolve(String(page)) })
    const base = "http://test.learn.odl.local:8062"
    expect(sitemapPage).toEqual([
      {
        url: `${base}${videoDetailPageView(
          videoWithPlaylists.id,
          playlistId,
          videoWithPlaylists.title,
        )}`,
        lastModified: videoWithPlaylists.last_modified ?? undefined,
      },
      {
        url: `${base}${videoDetailPageView(
          videoWithoutPlaylist.id,
          undefined,
          videoWithoutPlaylist.title,
        )}`,
        lastModified: videoWithoutPlaylist.last_modified ?? undefined,
      },
      {
        url: `${base}${videoPlaylistPageView(
          String(playlist.id),
          playlist.title,
        )}`,
        lastModified: playlist.last_modified ?? undefined,
      },
    ])
  })
})
