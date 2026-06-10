import { useRef } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { AxiosProgressEvent } from "axios"

import { websiteContentApi, mediaApi } from "../../clients"
import type {
  WebsiteContentApiWebsiteContentListRequest as WebsiteContentListRequest,
  WebsiteContent,
} from "../../generated/v1"
import { websiteContentQueries, websiteContentKeys } from "./queries"

const useWebsiteContentList = (
  params: WebsiteContentListRequest = {},
  opts?: { enabled?: boolean },
) => {
  return useQuery({
    ...websiteContentQueries.list(params),
    ...opts,
  })
}

/**
 * Query is disabled if id is undefined.
 */
const useWebsiteContentDetail = (id: number | undefined) => {
  return useQuery({
    ...websiteContentQueries.detail(id ?? -1),
    enabled: id !== undefined,
  })
}

const useWebsiteContentDetailRetrieve = (identifier: string | undefined) => {
  return useQuery({
    ...websiteContentQueries.websiteContentDetailRetrieve(identifier ?? ""),
    enabled: identifier !== undefined,
  })
}

const useWebsiteContentCreate = () => {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (
      data: Omit<
        WebsiteContent,
        | "id"
        | "user"
        | "created_on"
        | "updated_on"
        | "publish_date"
        | "cover_image"
      >,
    ) =>
      websiteContentApi
        .websiteContentCreate({ WebsiteContentRequest: data })
        .then((response) => response.data),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: websiteContentKeys.listRoot() })
    },
  })
}

export const useMediaUpload = () => {
  const nextProgressCb = useRef<((percent: number) => void) | undefined>(
    undefined,
  )

  const mutation = useMutation({
    mutationFn: async (data: { file: File }) => {
      const response = await mediaApi.mediaUpload(
        { image_file: data.file },
        {
          onUploadProgress: (e: AxiosProgressEvent) => {
            const percent = Math.round((e.loaded * 100) / (e.total ?? 1))
            nextProgressCb.current?.(percent)
          },
        },
      )

      return response.data
    },
    onSettled: () => {
      nextProgressCb.current = undefined
    },
  })

  return {
    ...mutation,
    /**
     * Set a callback to be called on the next upload progress event.
     *
     * NOTES:
     * - This callback will be cleared after the mutation settles (either success or error).
     * - This is a separate method, not part of the mutate/mutateAsync options,
     *   to avoid errors with function serialization. (E.g., Tanstack Query
     *   devtools attempt to serialize mutation options.)
     */
    setNextProgressCallback: (
      callback: ((percent: number) => void) | undefined,
    ) => {
      nextProgressCb.current = callback
    },
  }
}

const useWebsiteContentDestroy = () => {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => websiteContentApi.websiteContentDestroy({ id }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: websiteContentKeys.listRoot() })
    },
  })
}
const useWebsiteContentPartialUpdate = () => {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: Partial<WebsiteContent> & Pick<WebsiteContent, "id">) =>
      websiteContentApi
        .websiteContentPartialUpdate({
          id,
          PatchedWebsiteContentRequest: data,
        })
        .then((response) => response.data),
    onSuccess: (websiteContent: WebsiteContent) => {
      client.invalidateQueries({
        queryKey: websiteContentKeys.detail(websiteContent.id),
      })
      const identifier = websiteContent.slug || websiteContent.id.toString()
      client.invalidateQueries({
        queryKey: websiteContentKeys.websiteContentDetailRetrieve(identifier),
      })
    },
  })
}

export {
  useWebsiteContentList,
  useWebsiteContentDetail,
  useWebsiteContentCreate,
  useWebsiteContentDestroy,
  useWebsiteContentPartialUpdate,
  websiteContentQueries,
  useWebsiteContentDetailRetrieve,
}
