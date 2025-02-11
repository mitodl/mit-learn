import { QueryOptions } from "@tanstack/react-query"
import { widgetListsApi } from "../../clients"

const widgetListKeys = {
  root: ["widgetList"],
  detailRoot: () => [...widgetListKeys.root, "detail"],
  detail: (id: number) => [...widgetListKeys.detailRoot(), id],
}

const widgetListQueries = {
  detail: (id: number) =>
    ({
      queryKey: widgetListKeys.detail(id),
      queryFn: () =>
        widgetListsApi.widgetListsRetrieve({ id }).then((res) => res.data),
    }) satisfies QueryOptions,
}

export { widgetListQueries, widgetListKeys }
