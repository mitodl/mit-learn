import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query"

import { widgetListsApi } from "../../clients"
import widgetLists from "./keyFactory"
import { WidgetInstance } from "api/v0"

/**
 * Query is disabled if id is undefined.
 */
const useWidgetList = (id: number | undefined) => {
  return useQuery({
    ...widgetLists.detail(id ?? -1),
    enabled: id !== undefined,
  })
}

const useMutateWidgetsList = (id: number) => {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (data: WidgetInstance[]) =>
      widgetListsApi
        .widgetListsPartialUpdate({
          id: id,
          PatchedWidgetListRequest: { widgets: data as WidgetInstance[] },
        })
        .then((response) => response.data),

    onSuccess: (_data) => {
      client.invalidateQueries(widgetLists._def)
    },
  })
}

export { useWidgetList, useMutateWidgetsList }
