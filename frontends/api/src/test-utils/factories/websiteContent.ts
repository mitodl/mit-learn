import { faker } from "@faker-js/faker/locale/en"
import { makePaginatedFactory } from "ol-test-utilities"
import type { Factory } from "ol-test-utilities"
import type { WebsiteContent } from "../../generated/v1"

const websiteContent: Factory<WebsiteContent> = (overrides = {}) => {
  const title =
    (overrides.title as string | undefined) ?? faker.lorem.sentence()
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
     * No override is the common case. The resolved `seo_title` then mirrors the
     * title, as the serializer's does -- a fixture where the two disagree would
     * be one the API could never produce. `seo_description` stays blank because
     * the default `content` here has no banner subheading to infer from; a test
     * that wants one passes both the content and the resolved value.
     */
    seo_title_override: "",
    seo_description_override: "",
    seo_title: title,
    seo_description: "",
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
