/**
 * We generate an API client for the frontend using openapi-generator-typescript-axios.
 *
 * The generated code does not provide easy access to URLs, which are useful for
 * mocking requests during tests.
 */

import type {
  NewsEventsApiNewsEventsListRequest,
  TestimonialsApi,
  ChannelsApi,
  VectorLearningResourcesSearchApiVectorLearningResourcesSearchRetrieveRequest as VectorLearningResourcesSearchRequest,
} from "../generated/v0"
import type {
  LearningResourcesApi as LRApi,
  FeaturedApi,
  TopicsApi,
  LearningpathsApi,
  ArticlesApi,
  HubspotApi,
  WebsiteContentApi,
  UserlistsApi,
  OfferorsApi,
  PlatformsApi,
  LearningResourcesUserSubscriptionApi as SubscriptionApi,
  DepartmentsApi,
  SchoolsApi,
  VideoPlaylistsApi,
  LearningResourcesSearchApiLearningResourcesSearchRetrieveRequest as LearningResourcesSearchRequest,
} from "../generated/v1"
import type { BaseAPI } from "../generated/v1/base"
import type { BaseAPI as BaseAPIv0 } from "../generated/v0/base"
import { queryify } from "ol-test-utilities"

import learnAxios from "../axios"

// Keep these helpers absolute so the shared request mock can distinguish Learn
// and MITx requests by origin; switching to path-only URLs would reintroduce
// cross-backend collisions in tests. The base URL is read from the configured
// axios instance (the single source of truth).
const getApiBaseUrl = () => learnAxios.defaults.baseURL

// OpenAPI Generator declares parameters using interfaces, which makes passing
// them to functions a little annoying.
// See https://stackoverflow.com/questions/37006008/typescript-index-signature-is-missing-in-type for details.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const query = (params: any) => {
  if (!params || Object.keys(params).length === 0) return ""
  const queryString = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      if (value.length === 0) {
        queryString.append(key, "")
      } else {
        value.forEach((v) => queryString.append(key, String(v)))
      }
    } else {
      queryString.append(key, String(value))
    }
  }
  return `?${queryString.toString()}`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Callable = (...args: any[]) => void
type Params<API extends BaseAPI, K extends keyof API> = API[K] extends Callable
  ? Parameters<API[K]>[0]
  : never
type Paramsv0<
  API extends BaseAPIv0,
  K extends keyof API,
> = API[K] extends Callable ? Parameters<API[K]>[0] : never

const learningResources = {
  list: (params?: Params<LRApi, "learningResourcesList">) =>
    `${getApiBaseUrl()}/api/v1/learning_resources/${query(params)}`,
  details: (params: Params<LRApi, "learningResourcesRetrieve">) =>
    `${getApiBaseUrl()}/api/v1/learning_resources/${params.id}/`,
  summaryList: (params?: Params<LRApi, "learningResourcesList">) =>
    `${getApiBaseUrl()}/api/v1/learning_resources/summary/${query(params)}`,
  items: (params: Params<LRApi, "learningResourcesRetrieve">) =>
    `${getApiBaseUrl()}/api/v1/learning_resources/${params.id}/items/`,
  // Note: video playlist DETAIL goes through a different endpoint — see
  // `videoPlaylists.details` below (/api/v1/video_playlists/{id}/).
  featured: (params?: Params<FeaturedApi, "featuredList">) =>
    `${getApiBaseUrl()}/api/v1/featured/${query(params)}`,
  similar: (params: Params<LRApi, "learningResourcesSimilarList">) =>
    `${getApiBaseUrl()}/api/v1/learning_resources/${params.id}/similar/`,
  vectorSimilar: (
    params: Params<LRApi, "learningResourcesVectorSimilarList">,
  ) =>
    `${getApiBaseUrl()}/api/v1/learning_resources/${params.id}/vector_similar/`,
  setLearningPathRelationships: (
    params?: Params<LRApi, "learningResourcesLearningPathsPartialUpdate">,
  ) =>
    `${getApiBaseUrl()}/api/v1/learning_resources/${params?.id}/learning_paths/${params?.learning_path_id ? query({ learning_path_id: params?.learning_path_id }) : ""}`,
  setUserListRelationships: (
    params?: Params<LRApi, "learningResourcesUserlistsPartialUpdate">,
  ) =>
    `${getApiBaseUrl()}/api/v1/learning_resources/${params?.id}/userlists/${params?.userlist_id ? query({ userlist_id: params?.userlist_id }) : ""}`,
}

const offerors = {
  list: (params?: Params<OfferorsApi, "offerorsList">) =>
    `${getApiBaseUrl()}/api/v1/offerors/${query(params)}`,
}

const platforms = {
  list: (params?: Params<PlatformsApi, "platformsList">) =>
    `${getApiBaseUrl()}/api/v1/platforms/${query(params)}`,
}

const topics = {
  get: (id: number) => `${getApiBaseUrl()}/api/v1/topics/${id}/`,
  list: (params?: Params<TopicsApi, "topicsList">) =>
    `${getApiBaseUrl()}/api/v1/topics/${query(params)}`,
}

const departments = {
  list: (params?: Params<DepartmentsApi, "departmentsList">) =>
    `${getApiBaseUrl()}/api/v1/departments/${query(params)}`,
}

const schools = {
  list: (params?: Params<SchoolsApi, "schoolsList">) =>
    `${getApiBaseUrl()}/api/v1/schools/${query(params)}`,
}

const learningPaths = {
  list: (params?: Params<LearningpathsApi, "learningpathsList">) =>
    `${getApiBaseUrl()}/api/v1/learningpaths/${query(params)}`,
  resources: ({
    learning_resource_id: parentId,
    ...others
  }: Params<LearningpathsApi, "learningpathsItemsList">) =>
    `${getApiBaseUrl()}/api/v1/learningpaths/${parentId}/items/${query(others)}`,
  resourceDetails: ({
    learning_resource_id: parentId,
    id,
  }: Params<LearningpathsApi, "learningpathsItemsPartialUpdate">) =>
    `${getApiBaseUrl()}/api/v1/learningpaths/${parentId}/items/${id}/`,
  details: (params: Params<LearningpathsApi, "learningpathsRetrieve">) =>
    `${getApiBaseUrl()}/api/v1/learningpaths/${params.id}/`,
  membershipList: () => `${getApiBaseUrl()}/api/v1/learningpaths/membership/`,
}

const userLists = {
  list: (params?: Params<UserlistsApi, "userlistsList">) =>
    `${getApiBaseUrl()}/api/v1/userlists/${query(params)}`,
  resources: ({
    userlist_id: parentId,
    ...others
  }: Params<UserlistsApi, "userlistsItemsList">) =>
    `${getApiBaseUrl()}/api/v1/userlists/${parentId}/items/${query(others)}`,
  resourceDetails: ({
    userlist_id: parentId,
    id,
  }: Params<UserlistsApi, "userlistsItemsPartialUpdate">) =>
    `${getApiBaseUrl()}/api/v1/userlists/${parentId}/items/${id}/`,
  details: (params: Params<UserlistsApi, "userlistsRetrieve">) =>
    `${getApiBaseUrl()}/api/v1/userlists/${params.id}/`,
  membershipList: () => `${getApiBaseUrl()}/api/v1/userlists/membership/`,
}

const articles = {
  list: (params?: Params<ArticlesApi, "articlesList">) =>
    `${getApiBaseUrl()}/api/v1/articles/${query(params)}`,
  details: (id: number) => `${getApiBaseUrl()}/api/v1/articles/${id}/`,
  articlesDetailRetrieve: (identifier: string) =>
    `${getApiBaseUrl()}/api/v1/articles/detail/${identifier}/`,
}

const websiteContent = {
  list: (params?: Params<WebsiteContentApi, "websiteContentList">) =>
    `${getApiBaseUrl()}/api/v1/website_content/${query(params)}`,
  details: (id: number) => `${getApiBaseUrl()}/api/v1/website_content/${id}/`,
  detailRetrieve: (identifier: string) =>
    `${getApiBaseUrl()}/api/v1/website_content/detail/${identifier}/`,
}

const hubspot = {
  list: (params?: Params<HubspotApi, "hubspotFormsList">) =>
    `${getApiBaseUrl()}/api/v1/hubspot/forms/${query(params)}`,
  details: (params: Params<HubspotApi, "hubspotFormsDetailRetrieve">) =>
    `${getApiBaseUrl()}/api/v1/hubspot/forms/${params.form_id}/`,
  submit: (formId: string) =>
    `${getApiBaseUrl()}/api/v1/hubspot/forms/${formId}/submit/`,
}

const userSubscription = {
  list: (
    params?: Params<SubscriptionApi, "learningResourcesUserSubscriptionList">,
  ) =>
    `${getApiBaseUrl()}/api/v1/learning_resources_user_subscription/${query(params)}`,
  check: (
    params?: Params<
      SubscriptionApi,
      "learningResourcesUserSubscriptionCheckList"
    >,
  ) =>
    `${getApiBaseUrl()}/api/v1/learning_resources_user_subscription/check/${query(params)}`,
  delete: (id: number) =>
    `${getApiBaseUrl()}/api/v1/learning_resources_user_subscription/${id}/unsubscribe/`,
  post: () =>
    `${getApiBaseUrl()}/api/v1/learning_resources_user_subscription/subscribe/`,
}

const channels = {
  counts: (channelType: string) =>
    `${getApiBaseUrl()}/api/v0/channels/counts/${channelType}/`,
  details: (channelType: string, name: string) =>
    `${getApiBaseUrl()}/api/v0/channels/type/${channelType}/${name}/`,
  patch: (id: number) => `${getApiBaseUrl()}/api/v0/channels/${id}/`,
  list: (params?: Paramsv0<ChannelsApi, "channelsList">) =>
    `${getApiBaseUrl()}/api/v0/channels/${query(params)}`,
}

const widgetLists = {
  details: (id: number) => `${getApiBaseUrl()}/api/v0/widget_lists/${id}/`,
}

const programLetters = {
  details: (id: string) => `${getApiBaseUrl()}/api/v1/program_letters/${id}/`,
}

const testimonials = {
  list: (params?: Paramsv0<TestimonialsApi, "testimonialsList">) =>
    `${getApiBaseUrl()}/api/v0/testimonials/${query(params)}`,
  details: (id: number) => `${getApiBaseUrl()}/api/v0/testimonials/${id}/`,
}

const search = {
  resources: (params?: LearningResourcesSearchRequest) =>
    `${getApiBaseUrl()}/api/v1/learning_resources_search/${queryify(params)}`,
  vectorResources: (params?: VectorLearningResourcesSearchRequest) =>
    `${getApiBaseUrl()}/api/v0/vector_learning_resources_search/${queryify(params)}`,
}

const userMe = {
  get: () => `${getApiBaseUrl()}/api/v0/users/me/`,
}

const adminSearchParams = {
  get: () =>
    `${getApiBaseUrl()}/api/v0/learning_resources_search_admin_params/`,
}

const profileMe = {
  get: () => `${getApiBaseUrl()}/api/v0/profiles/me/`,
  patch: () => `${getApiBaseUrl()}/api/v0/profiles/me/`,
}

const newsEvents = {
  list: (params?: NewsEventsApiNewsEventsListRequest) =>
    `${getApiBaseUrl()}/api/v0/news_events/${query(params)}`,
}

const videoPlaylists = {
  details: (params: Params<VideoPlaylistsApi, "videoPlaylistsRetrieve">) =>
    `${getApiBaseUrl()}/api/v1/video_playlists/${params.id}/`,
}

export {
  learningResources,
  videoPlaylists,
  topics,
  learningPaths,
  articles,
  websiteContent,
  hubspot,
  search,
  userLists,
  programLetters,
  channels,
  widgetLists,
  offerors,
  userMe,
  profileMe,
  platforms,
  userSubscription,
  schools,
  departments,
  newsEvents,
  testimonials,
  adminSearchParams,
}
