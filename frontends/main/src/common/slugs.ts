const SLUG_MAX_LENGTH = 60

/**
 * Derive a cosmetic URL slug from a resource title. Returns "" when the title
 * yields no ascii letters; callers handle blank per surface (paths use the
 * literal "resource" segment, the drawer omits the resource_title param).
 * The slug is NEVER used for lookup — the numeric id is authoritative.
 *
 * Steps (see the readable-URLs spec, mitodl/hq#11210):
 *  1. NFKD-normalize, strip combining marks (accented Latin → ascii).
 *  2. lowercase.
 *  3. each run of non-[a-z0-9] → single "-".
 *  4. trim, truncate at 60 backing off to the last "-", re-trim trailing "-".
 * Returns "" if the result has no [a-z] letter.
 */
export const slugify = (title: string): string => {
  const normalized = title
    .normalize("NFKD")
    .replace(/\p{Mn}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  let truncated = normalized
  if (truncated.length > SLUG_MAX_LENGTH) {
    truncated = truncated.slice(0, SLUG_MAX_LENGTH)
    const lastDash = truncated.lastIndexOf("-")
    if (lastDash !== -1) {
      truncated = truncated.slice(0, lastDash)
    }
    truncated = truncated.replace(/-+$/g, "")
  }

  return /[a-z]/.test(truncated) ? truncated : ""
}

/**
 * Parse a bare numeric resource id. Accepts only a positive-integer string
 * ("2813"); rejects non-strings, arrays (repeated query params), and anything
 * non-integer ("2813-foo", "abc", "0", "", " 12"). Id and slug are never fused,
 * so a value like "2813-beyond-biology" is malformed here, not a slug to split.
 */
export const parseResourceId = (
  value: string | string[] | null | undefined,
): number | null => {
  if (typeof value !== "string") return null
  if (!/^\d+$/.test(value)) return null
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : null
}

/**
 * Canonical parent podcast id for an episode. The episode id is authoritative;
 * keep the URL's podcast id if the episode belongs to it, else the first
 * podcast. Returns null when the episode has no podcasts.
 */
export const resolveEpisodeParent = (
  parentIds: number[],
  incomingPodcastId: number,
): number | null => {
  if (parentIds.length === 0) return null
  return parentIds.includes(incomingPodcastId)
    ? incomingPodcastId
    : parentIds[0]
}

/**
 * Canonical playlist id for a video. A ?playlist value is honored iff it is a
 * single value that is one of the video's playlists; otherwise (missing,
 * non-member, non-numeric, or repeated/array) fall back to playlists[0].
 * Returns null when the video has no playlists.
 */
export const resolveVideoPlaylist = (
  playlists: number[],
  rawParam: string | string[] | undefined,
): number | null => {
  if (typeof rawParam === "string") {
    const parsed = Number(rawParam)
    if (Number.isInteger(parsed) && playlists.includes(parsed)) return parsed
  }
  return playlists[0] ?? null
}

/**
 * A video's valid playlist ids (positive integers, API order). The single
 * rule for "which playlist is canonical" — pages, sitemap, and link builders
 * must agree on [0] or sitemap/link URLs won't match the page's canonical.
 */
export const videoPlaylistIds = (video: {
  playlists?: Array<string | number> | null
}): number[] =>
  (video.playlists ?? [])
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0)

/** An episode's valid parent podcast ids (positive integers, API order). */
export const parentPodcastIds = (episode: {
  podcast_episode?: { podcasts?: Array<string | number> | null } | null
}): number[] =>
  (episode.podcast_episode?.podcasts ?? [])
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0)
