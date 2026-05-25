import { createContext, useContext } from "react"
import type { WebsiteContent } from "api/v1"

interface WebsiteContentContextValue {
  contentItem?: WebsiteContent
}

const WebsiteContentContext = createContext<WebsiteContentContextValue>({})

export const WebsiteContentProvider = WebsiteContentContext.Provider

export function useWebsiteContent() {
  return useContext(WebsiteContentContext).contentItem
}
