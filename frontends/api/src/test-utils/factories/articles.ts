import { faker } from "@faker-js/faker/locale/en"
import { makePaginatedFactory } from "ol-test-utilities"
import type { Factory } from "ol-test-utilities"
import type { RichTextArticle } from "../../generated/v1"

const article: Factory<RichTextArticle> = (overrides = {}) => ({
  id: faker.number.int(),
  title: faker.lorem.sentence(),
  content: {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: faker.lorem.paragraph() }],
      },
    ],
  },
  user: {
    first_name: faker.person.firstName(),
    last_name: faker.person.lastName(),
  },
  created_on: faker.date.past().toISOString(),
  publish_date: faker.date.past().toISOString(),
  updated_on: faker.date.recent().toISOString(),
  ...overrides,
})

const articles = makePaginatedFactory(article)

export { article, articles }
