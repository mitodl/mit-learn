import { createContext, useContext } from "react"
import type { RichTextArticle } from "api/v1"

interface ArticleContextValue {
  article?: RichTextArticle
}

const ArticleContext = createContext<ArticleContextValue>({})

export const ArticleProvider = ArticleContext.Provider

export function useArticle() {
  return useContext(ArticleContext).article
}
