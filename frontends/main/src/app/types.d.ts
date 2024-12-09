type PageParamsWithRouteParams<SearchParams, RouteParams> = {
  searchParams?: Promise<SearchParams>
  params?: Promise<RouteParams>
}

type PageParamsWithoutRouteParams<SearchParams> = {
  searchParams?: Promise<SearchParams>
}

export type PageParams<
  SearchParams = Record<string, string | string[] | undefined>,
  RouteParams = Record<string, never>,
> =
  RouteParams extends Record<string, never>
    ? PageParamsWithoutRouteParams<SearchParams>
    : PageParamsWithRouteParams<SearchParams, RouteParams>
