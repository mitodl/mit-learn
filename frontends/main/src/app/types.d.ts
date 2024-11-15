export type SearchParams = {
  [key: string]: string | string[] | undefined
}

export type PageParams<RouteParams = Record<string, never>> = {
  params?: Promise<RouteParams>
  searchParams?: Promise<SearchParams>
}
