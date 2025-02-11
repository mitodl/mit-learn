import { QueryOptions } from "@tanstack/react-query"
import { articlesApi } from "../../clients"
import type { ArticlesApiArticlesListRequest as ArticleListRequest } from "../../generated/v1"

const articleKeys = {
  root: ["articles"],
  listRoot: () => [...articleKeys.root, "list"],
  list: (params: ArticleListRequest) => [...articleKeys.listRoot(), params],
  detailRoot: () => [...articleKeys.root, "detail"],
  detail: (id: number) => [...articleKeys.detailRoot(), id],
}

const articleQueries = {
  list: (params: ArticleListRequest) =>
    ({
      queryKey: articleKeys.list(params),
      queryFn: () => articlesApi.articlesList(params).then((res) => res.data),
    }) satisfies QueryOptions,
  detail: (id: number) =>
    ({
      queryKey: articleKeys.detail(id),
      queryFn: () =>
        articlesApi.articlesRetrieve({ id }).then((res) => res.data),
    }) satisfies QueryOptions,
}

export { articleQueries, articleKeys }
