export const toRelativeApiUrl = (url: string) => {
  const parsed = new URL(url, "https://placeholder.invalid")
  return `${parsed.pathname}${parsed.search}`
}
