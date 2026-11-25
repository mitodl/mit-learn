import { constructSitemapIndex } from "./util"

const parse = (xml: string) => {
  const doc = new DOMParser().parseFromString(xml, "application/xml")
  expect(doc.getElementsByTagName("parsererror")).toHaveLength(0)
  return doc
}

describe("constructSitemapIndex", () => {
  it("serves the entries as a sitemap index", async () => {
    const GET = constructSitemapIndex(async () => [
      { loc: "https://learn.mit.edu/a.xml", lastmod: "2026-11-04T18:27:04Z" },
      { loc: "https://learn.mit.edu/b.xml" },
    ])

    const response = await GET()
    const doc = parse(await response.text())

    expect(response.headers.get("Content-Type")).toBe("application/xml")
    expect(doc.documentElement.localName).toBe("sitemapindex")
    expect(doc.documentElement.namespaceURI).toBe(
      "http://www.sitemaps.org/schemas/sitemap/0.9",
    )
    const entries = Array.from(doc.getElementsByTagName("sitemap")).map(
      (sitemap) => ({
        loc: sitemap.getElementsByTagName("loc")[0]?.textContent,
        lastmod: sitemap.getElementsByTagName("lastmod")[0]?.textContent,
      }),
    )
    expect(entries).toEqual([
      { loc: "https://learn.mit.edu/a.xml", lastmod: "2026-11-04T18:27:04Z" },
      { loc: "https://learn.mit.edu/b.xml", lastmod: undefined },
    ])
  })

  it("escapes XML special characters in loc", async () => {
    const GET = constructSitemapIndex(async () => [
      { loc: "https://learn.mit.edu/a&b.xml" },
    ])

    const xml = await (await GET()).text()

    expect(xml).toContain("<loc>https://learn.mit.edu/a&amp;b.xml</loc>")
    expect(parse(xml).getElementsByTagName("loc")[0].textContent).toBe(
      "https://learn.mit.edu/a&b.xml",
    )
  })

  it("rejects when the entries cannot be loaded", async () => {
    const GET = constructSitemapIndex(async () => {
      throw new Error("API down")
    })

    await expect(GET()).rejects.toThrow("API down")
  })
})
