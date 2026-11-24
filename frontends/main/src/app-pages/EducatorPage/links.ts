import { querifiedSearchUrl } from "@/common/urls"

/**
 * Search pages the educator page links into. Most are scoped to OCW, whose
 * courses carry the open licenses the page is about. Open textbooks are not:
 * they open the Learning Materials tab with the Open Textbook facet, across
 * every offeror.
 */
export const SEARCH_OCW_COURSES = querifiedSearchUrl({
  offered_by: "ocw",
  resource_type_group: "course",
})
export const SEARCH_LECTURE_VIDEOS = querifiedSearchUrl({
  offered_by: "ocw",
  resource_type: "video",
  // Excludes OCW's other videos, e.g. Instructor Insights.
  resource_category: "Lecture Video",
})
export const SEARCH_OPEN_TEXTBOOKS = querifiedSearchUrl({
  resource_category: "Open Textbook",
  resource_type_group: "learning_material",
})
export const SEARCH_INSTRUCTOR_INSIGHTS = querifiedSearchUrl({
  course_feature: "Instructor Insights",
})
export const SEARCH_VIDEOS_AND_PODCASTS = querifiedSearchUrl([
  ["offered_by", "ocw"],
  ["resource_type", "video"],
  ["resource_type", "podcast_episode"],
])

/** Where "Give now" goes while the Support page's feature flag is off. */
export const OCW_GIVE_URL = "https://giving.mit.edu/give/to/ocw/"
/** OCW's signup page; it prefills its Mailchimp form from the EMAIL param. */
export const OCW_NEWSLETTER_URL = "https://ocw.mit.edu/newsletter/"

export const OCW_SOCIAL = {
  facebook: "https://www.facebook.com/MITOCW",
  instagram: "https://www.instagram.com/mitocw/",
  x: "https://x.com/MITOCW",
  youtube: "https://www.youtube.com/mitocw",
  linkedin: "https://www.linkedin.com/company/mit-opencourseware/",
}
