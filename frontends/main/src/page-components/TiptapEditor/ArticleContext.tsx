import { createContext, useContext } from "react"
import type { WebsiteContent } from "api/v1"

interface WebsiteContentContextValue {
  article?: WebsiteContent
}

const WebsiteContentContext = createContext<WebsiteContentContextValue>({})

export const WebsiteContentProvider = WebsiteContentContext.Provider

export function useWebsiteContent() {
  return useContext(WebsiteContentContext).article
}

/** @deprecated Use WebsiteContentProvider */
export const ArticleProvider = WebsiteContentProvider

/** @deprecated Use useWebsiteContent */
export function useArticle() {
  return useWebsiteContent()
}
