import type {
  LearningResourcesApiLearningResourcesListRequest as LRListRequest,
  LearningResourcesApiLearningResourcesItemsListRequest as LRItemsListRequest,
  LearningResourcesSearchApiLearningResourcesSearchRetrieveRequest as SearchRequest,
  FeaturedApiFeaturedListRequest as FeaturedListParams,
  LearningResourcesApiLearningResourcesSimilarListRequest as SimilarListParams,
  LearningResourcesApiLearningResourcesVectorSimilarListRequest as VectorSimilarListParams,
} from "api"
import type { ChannelsApiChannelsTypeFeaturedListRequest as ChannelFeaturedParams } from "api/v0"
import type { LearningResourceCardProps } from "ol-components"

interface ResourceDataSource {
  type: "resources"
  params: LRListRequest
}

interface ResourceItemsDataSource {
  type: "resource_items"
  params: LRItemsListRequest
}

interface SearchDataSource {
  type: "lr_search"
  params: SearchRequest
}

interface FeaturedDataSource {
  type: "lr_featured"
  params: FeaturedListParams
}

/** A single channel's own featured learning path, published or not. */
interface ChannelFeaturedDataSource {
  type: "channel_featured"
  params: ChannelFeaturedParams
}

interface SimilarDataSource {
  type: "lr_similar"
  params: SimilarListParams
}

interface VectorSimilarDataSource {
  type: "lr_vector_similar"
  params: VectorSimilarListParams
}

type DataSource =
  | ResourceDataSource
  | ResourceItemsDataSource
  | SearchDataSource
  | FeaturedDataSource
  | ChannelFeaturedDataSource
  | SimilarDataSource
  | VectorSimilarDataSource

type TabConfig<D extends DataSource = DataSource> = {
  label: React.ReactNode
  cardProps?: Pick<LearningResourceCardProps, "size" | "isMedia">
  data: D
}

export type {
  TabConfig,
  ResourceDataSource,
  SearchDataSource,
  FeaturedDataSource,
  ChannelFeaturedDataSource,
  DataSource,
}
