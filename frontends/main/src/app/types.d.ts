export type SearchParams = {
  [key: string]: string | string[] | undefined
}

type PageParamsWithRouteParams<RouteParams> = {
  params: Promise<RouteParams>
  searchParams?: Promise<SearchParams>
}

type PageParamsWithoutRouteParams = {
  searchParams?: Promise<SearchParams>
}

export type PageParams<RouteParams = Record<string, never>> =
  RouteParams extends Record<string, never>
    ? PageParamsWithoutRoute
    : PageParamsWithRoute<RouteParams>
