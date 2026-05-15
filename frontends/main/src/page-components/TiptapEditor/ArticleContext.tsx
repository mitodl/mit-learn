import { createContext, useContext } from "react"
import type { WebsiteContent } from "api/v1"

interface ArticleContextValue {
  article?: WebsiteContent
}

const ArticleContext = createContext<ArticleContextValue>({})

export const ArticleProvider = ArticleContext.Provider

export function useArticle() {
  return useContext(ArticleContext).article
}
