import { faker } from "@faker-js/faker/locale/en"
import { makePaginatedFactory } from "ol-test-utilities"
import type { Factory } from "ol-test-utilities"
import type { RichTextArticle } from "../../generated/v1"

const richTextArticle: Factory<RichTextArticle> = (overrides = {}) => ({
  id: faker.number.int(),
  title: faker.lorem.sentence(),
  html: faker.lorem.paragraph(),
  ...overrides,
})

const richTextArticles = makePaginatedFactory(richTextArticle)

export { richTextArticle, richTextArticles }
