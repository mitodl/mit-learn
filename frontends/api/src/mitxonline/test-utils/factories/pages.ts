import { faker } from "@faker-js/faker/locale/en"
import { mergeOverrides } from "ol-test-utilities"
import type { PartialFactory, Factory } from "ol-test-utilities"
import type {
  FeatureImage,
  CoursePageItem,
  PriceItem,
  Faculty,
} from "@mitodl/mitxonline-api-axios/v2"
import { UniqueEnforcer } from "enforce-unique"
import { v2Course } from "./courses"

const featureImage: Factory<FeatureImage> = (override) => {
  return {
    height: faker.number.int({ min: 100, max: 1000 }),
    image_url: faker.internet.url(),
    title: faker.lorem.words(3),
    width: faker.number.int({ min: 100, max: 1000 }),
    ...override,
  }
}

const priceItem: Factory<PriceItem> = (override) => {
  return {
    id: faker.string.uuid(),
    type: "price_details",
    value: { link: "", text: "$99.00" },
    ...override,
  }
}

const faculty: Factory<Faculty> = (override) => {
  return {
    feature_image_src: faker.image.urlLoremFlickr({ width: 640, height: 480 }),
    id: faker.number.int({ min: 1, max: 1000 }),
    instructor_bio_long: faker.lorem.paragraphs(2),
    instructor_bio_short: faker.lorem.sentences(2),
    instructor_name: faker.person.fullName(),
    instructor_title: faker.person.jobTitle(),
    ...override,
  }
}

const uniquePageId = new UniqueEnforcer()

const coursePageItem: PartialFactory<CoursePageItem> = (override) => {
  const defaults: CoursePageItem = {
    about: faker.lorem.paragraphs(3),
    certificate_page: null,
    course_details: v2Course(),
    description: faker.lorem.sentences(2),
    effort: `${faker.number.int({ min: 1, max: 10 })} hours per week`,
    faculty: [faculty(), faculty()],
    faculty_section_title: "About the Faculty",
    faq_url: faker.internet.url(),
    feature_image: featureImage(),
    id: uniquePageId.enforce(() => faker.number.int()),
    include_in_learn_catalog: faker.datatype.boolean(),
    ingest_content_files_for_ai: faker.datatype.boolean(),
    length: `${faker.number.int({ min: 1, max: 12 })} weeks`,
    max_price: faker.number.int({ min: 50, max: 500 }),
    max_weekly_hours: `${faker.number.int({ min: 1, max: 20 })}`,
    max_weeks: faker.number.int({ min: 1, max: 12 }),
    meta: {
      alias_of: null,
      detail_url: faker.internet.url(),
      first_published_at: faker.date.past().toISOString(),
      html_url: faker.internet.url(),
      last_published_at: faker.date.recent().toISOString(),
      live: true,
      locale: "en-us",
      search_description: faker.lorem.sentence(),
      seo_title: faker.lorem.sentence(),
      show_in_menus: false,
      slug: faker.lorem.slug(),
      type: "cms.CertificatePage",
    },
    min_price: faker.number.int({ min: 0, max: 49 }),
    min_weekly_hours: `${faker.number.int({ min: 1, max: 20 })}`,
    min_weeks: faker.number.int({ min: 1, max: 12 }),
    prerequisites: faker.lorem.sentences(2),
    price: [priceItem()],
    title: faker.lorem.words(3),
    topic_list: [
      {
        name: faker.lorem.word(),
        parent: faker.lorem.word(),
      },
    ],
    video_url: faker.internet.url(),
    what_you_learn: faker.lorem.sentences(4),
  }
  return mergeOverrides(defaults, override)
}

export { coursePageItem }
