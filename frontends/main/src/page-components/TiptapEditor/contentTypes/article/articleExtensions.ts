/**
 * Article content type extensions.
 *
 * Currently mirrors the news content type. Extensions and document structure
 * will diverge as the /articles feature evolves.
 */
export {
  createNewsExtensions as createArticleExtensions,
  newNewsDocument as newArticleDocument,
  NewsDocument as ArticleDocument,
} from "../news/newsExtensions"
