import { faker } from "@faker-js/faker/locale/en"
import { makePaginatedFactory } from "ol-test-utilities"
import type { Factory } from "ol-test-utilities"
import type { RichTextArticle } from "../../generated/v1"

const article: Factory<RichTextArticle> = (overrides = {}) => ({
  id: faker.number.int(),
  title: faker.lorem.sentence(),
  content: {
    text: faker.lorem.paragraph(),
    author: faker.person.fullName(),
  },
  user: {
    first_name: faker.person.firstName(),
    last_name: faker.person.lastName(),
  },
  created_on: faker.date.past().toISOString(),
  updated_on: faker.date.recent().toISOString(),
  ...overrides,
})

const articles = makePaginatedFactory(article)

export { article, articles }
