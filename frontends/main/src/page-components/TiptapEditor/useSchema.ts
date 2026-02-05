"use client"

import { useEffect, useState } from "react"
import { Node } from "@tiptap/pm/model"
import type { Schema } from "@tiptap/pm/model"
import type { JSONContent } from "@tiptap/react"

interface UseSchemaOptions {
  schema: Schema
  content: JSONContent
  enabled?: boolean
}

export const useSchema = ({
  schema,
  content,
  enabled = true,
}: UseSchemaOptions) => {
  const [schemaError, setSchemaError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) {
      return
    }

    const docType = schema.nodes.doc
    if (!docType) {
      queueMicrotask(() => {
        setSchemaError("Document node type not found in schema")
      })
      return
    }

    const contentArray = content.content || []

    const contentMatch = docType.contentMatch
    let match = contentMatch

    for (let i = 0; i < contentArray.length; i++) {
      const jsonNode = contentArray[i]
      const nodeTypeName = jsonNode.type

      if (typeof nodeTypeName !== "string") {
        const errorMessage =
          "Invalid content for node doc: node type must be a string"
        queueMicrotask(() => {
          setSchemaError(`Document schema check failed: ${errorMessage}`)
        })
        return
      }

      const nodeType = schema.nodes[nodeTypeName]
      if (!nodeType) {
        const errorMessage = `Invalid content for node doc: node type "${nodeTypeName}" not found in schema`
        queueMicrotask(() => {
          setSchemaError(`Document schema check failed: ${errorMessage}`)
        })
        return
      }

      const nextMatch = match.matchType(nodeType)

      if (!nextMatch) {
        queueMicrotask(() => {
          setSchemaError(
            `Document schema check failed: Invalid content for node doc: ${jsonNode.type} is not allowed in this position`,
          )
        })
        return
      }
      match = nextMatch
    }

    if (!match.validEnd) {
      queueMicrotask(() => {
        setSchemaError(
          "Document schema check failed: Invalid content for node doc: content specification not satisfied",
        )
      })
      return
    }

    let contentNode: Node
    try {
      contentNode = Node.fromJSON(schema, content)
    } catch (parseError) {
      queueMicrotask(() => {
        setSchemaError(
          `Failed to parse content: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
        )
      })
      return
    }

    try {
      contentNode.check()
      queueMicrotask(() => {
        setSchemaError(null)
      })
    } catch (error) {
      const errorMessage = `Document schema check failed: ${error instanceof Error ? error.message : String(error)}`
      queueMicrotask(() => {
        setSchemaError(errorMessage)
      })
    }
  }, [schema, content, enabled])

  return schemaError
}
