"use client"

import { useMemo } from "react"
import { getSchema } from "@tiptap/core"
import { useSchema } from "./useSchema"
import type { JSONContent } from "@tiptap/react"
import {
  createNewsExtensions,
  newNewsDocument,
} from "./contentTypes/news/newsExtensions"

interface UseArticleSchemaOptions {
  uploadHandler: (
    file: File,
    onProgress?: (e: { progress: number }) => void,
    abortSignal?: AbortSignal,
  ) => Promise<string>
  setUploadError: (error: string | null) => void
  enabled: boolean
  content: JSONContent
}

/** @deprecated Use newNewsDocument from contentTypes/news/newsExtensions */
export const newArticleDocument = newNewsDocument

export const useArticleSchema = ({
  uploadHandler,
  setUploadError,
  enabled,
  content,
}: UseArticleSchemaOptions) => {
  const extensions = useMemo(
    () => createNewsExtensions(uploadHandler, setUploadError),
    [uploadHandler, setUploadError],
  )

  const schema = useMemo(() => getSchema(extensions), [extensions])

  const schemaError = useSchema({
    schema,
    content,
    enabled,
  })

  return {
    extensions,
    schema,
    schemaError,
  }
}
