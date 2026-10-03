import { faker } from "@faker-js/faker/locale/en"
import { makePaginatedFactory } from "ol-test-utilities"
import type { Factory } from "ol-test-utilities"
import type { WebsiteContent } from "../../generated/v1"

const websiteContent: Factory<WebsiteContent> = (overrides = {}) => ({
  id: faker.number.int(),
  title: faker.lorem.sentence(),
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
  // The API always sends these, empty or not, so fixtures should too. Blank
  // SEO fields are the common case: the page head falls back to the title and
  // the opening of the body, as it did before they existed.
  topics: [],
  seo_title: "",
  seo_description: "",
  user: {
    first_name: faker.person.firstName(),
    last_name: faker.person.lastName(),
  },
  created_on: faker.date.past().toISOString(),
  publish_date: faker.date.past().toISOString(),
  updated_on: faker.date.recent().toISOString(),
  ...overrides,
})

const websiteContents = makePaginatedFactory(websiteContent)

export { websiteContent, websiteContents }
