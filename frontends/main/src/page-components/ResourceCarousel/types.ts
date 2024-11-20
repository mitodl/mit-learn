import type {
  LearningResourcesApiLearningResourcesListRequest as LRListRequest,
  LearningResourcesSearchApiLearningResourcesSearchRetrieveRequest as SearchRequest,
  FeaturedApiFeaturedListRequest as FeaturedListParams,
  SimilarLearningResourcesApiSimilarLearningResourcesListRequest as SimilarListParams,
} from "api"
import type { LearningResourceCardProps } from "ol-components"

interface ResourceDataSource {
  type: "resources"
  params: LRListRequest
}

interface SearchDataSource {
  type: "lr_search"
  params: SearchRequest
}

interface FeaturedDataSource {
  type: "lr_featured"
  params: FeaturedListParams
}

interface SimilarDataSource {
  type: "lr_similar"
  params: SimilarListParams
}

type DataSource =
  | ResourceDataSource
  | SearchDataSource
  | FeaturedDataSource
  | SimilarDataSource

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
  DataSource,
}
