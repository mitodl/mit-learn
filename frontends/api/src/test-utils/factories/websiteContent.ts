import { faker } from "@faker-js/faker/locale/en"
import { makePaginatedFactory } from "ol-test-utilities"
import type { Factory } from "ol-test-utilities"
import type { WebsiteContent } from "../../generated/v1"

const websiteContent: Factory<WebsiteContent> = (overrides = {}) => {
  const title =
    (overrides.title as string | undefined) ?? faker.lorem.sentence()
  /**
   * Resolved the way the serializer resolves them, from whatever overrides the
   * caller supplied, so a fixture cannot claim an override and a resolved
   * value that disagree -- a response the API never produces.
   *
   * An explicit `seo_title` or `seo_description` still wins, via the spread
   * below: a test that wants an inferred description passes the content it was
   * inferred from and the value together.
   */
  const titleOverride =
    (overrides.seo_title_override as string | undefined) ?? ""
  const descriptionOverride =
    (overrides.seo_description_override as string | undefined) ?? ""
  return {
    id: faker.number.int(),
    title,
    cover_image: faker.image.url(),
    content: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: faker.lorem.paragraph() }],
        },
      ],
    },
    // The API always sends these, empty or not, so fixtures should too.
    topics: [],
    /**
     * No override is the common case: the resolved title is then the content's
     * own. The resolved description defaults to blank rather than to anything
     * inferred, because the default `content` here has no banner subheading --
     * a test that wants one passes the content and the resolved value together.
     */
    seo_title_override: titleOverride,
    seo_description_override: descriptionOverride,
    seo_title: titleOverride || title,
    seo_description: descriptionOverride,
    user: {
      first_name: faker.person.firstName(),
      last_name: faker.person.lastName(),
    },
    created_on: faker.date.past().toISOString(),
    publish_date: faker.date.past().toISOString(),
    updated_on: faker.date.recent().toISOString(),
    ...overrides,
  }
}

const websiteContents = makePaginatedFactory(websiteContent)

export { websiteContent, websiteContents }
