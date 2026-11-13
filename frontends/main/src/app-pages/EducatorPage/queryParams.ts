import type {
  CoursesApiCoursesListRequest,
  PodcastEpisodesApiPodcastEpisodesListRequest,
  VideosApiVideosListRequest,
} from "api"

/**
 * Query params for the page's API calls, shared with the route so the server
 * prefetches exactly the queries the sections read. Kept out of the "use
 * client" section files: a server component importing a value from one gets a
 * client reference, not the value.
 */

export const SELECTED_COURSES_PARAMS: CoursesApiCoursesListRequest = {
  offered_by: ["ocw"],
  free: true,
  limit: 12,
  sortby: "-views",
}

/**
 * The featured card and the first side card of "Learn from MIT teaching
 * practices" are the two newest OCW videos; the second side card is the newest
 * OCW podcast episode (Chalk Radio).
 */
export const TEACHING_VIDEOS_PARAMS: VideosApiVideosListRequest = {
  offered_by: ["ocw"],
  limit: 2,
  sortby: "new",
}

export const TEACHING_PODCAST_EPISODES_PARAMS: PodcastEpisodesApiPodcastEpisodesListRequest =
  {
    offered_by: ["ocw"],
    limit: 1,
    sortby: "new",
  }
