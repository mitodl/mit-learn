import { faker } from "@faker-js/faker/locale/en"
import { mergeOverrides } from "ol-test-utilities"
import type { PartialFactory, Factory } from "ol-test-utilities"
import type {
  FeatureImage,
  CoursePageItem,
  PriceItem,
  Faculty,
  CoursePageList,
  V2Course,
} from "@mitodl/mitxonline-api-axios/v2"
import { UniqueEnforcer } from "enforce-unique"

const makeHTMLParagraph = (num: number) => {
  return Array.from(
    { length: num },
    () => `<p>${faker.lorem.paragraph()}</p>`,
  ).join("\n\n")
}
const makeHTMLList = (num: number) => {
  return `<ul>\n${Array.from(
    { length: num },
    () => `  <li>${faker.lorem.sentence()}</li>`,
  ).join("\n")}\n</ul>`
}

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
    instructor_bio_long: makeHTMLParagraph(2),
    instructor_bio_short: faker.lorem.sentences(2),
    instructor_name: faker.person.fullName(),
    instructor_title: faker.person.jobTitle(),
    ...override,
  }
}

const uniqueCourseId = new UniqueEnforcer()

const v2Course: PartialFactory<V2Course> = (overrides = {}) => {
  const defaults: V2Course = {
    id: uniqueCourseId.enforce(() => faker.number.int()),
    title: faker.lorem.words(3),
    readable_id: faker.lorem.slug(),
    page: {
      feature_image_src: faker.image.avatar(),
      page_url: faker.internet.url(),
      description: faker.lorem.paragraph(),
      live: faker.datatype.boolean(),
      length: `${faker.number.int({ min: 1, max: 12 })} weeks`,
      effort: `${faker.number.int({ min: 1, max: 10 })} hours/week`,
      financial_assistance_form_url: faker.internet.url(),
      instructors: [
        {
          name: faker.person.fullName(),
          bio: faker.lorem.paragraph(),
        },
        {
          name: faker.person.fullName(),
          bio: faker.lorem.paragraph(),
        },
      ],
      current_price: faker.number.int({ min: 0, max: 1000 }),
    },
    availability: faker.helpers.arrayElement(["anytime", "dated"]),
    min_weekly_hours: `${faker.number.int({ min: 1, max: 5 })} hours`,
    max_weekly_hours: `${faker.number.int({ min: 6, max: 10 })} hours`,
    certificate_type: faker.lorem.word(),
    required_prerequisites: faker.datatype.boolean(),
    duration: `${faker.number.int({ min: 1, max: 12 })} weeks`,
    min_weeks: faker.number.int({ min: 1, max: 4 }),
    max_weeks: faker.number.int({ min: 5, max: 12 }),
    time_commitment: `${faker.number.int({ min: 1, max: 10 })} hours/week`,
    topics: [
      {
        name: faker.lorem.word(),
      },
    ],
    departments: [
      {
        name: faker.company.name(),
      },
    ],
    programs: null,
    min_price: faker.number.int({ min: 0, max: 1000 }),
    max_price: faker.number.int({ min: 1000, max: 2000 }),
    include_in_learn_catalog: faker.datatype.boolean(),
    ingest_content_files_for_ai: faker.datatype.boolean(),
    next_run_id: faker.number.int(),
  }
  return mergeOverrides<V2Course>(defaults, overrides)
}

const uniquePageId = new UniqueEnforcer()
const coursePageItem: PartialFactory<CoursePageItem> = (override) => {
  const defaults: CoursePageItem = {
    about: makeHTMLParagraph(3),
    certificate_page: null,
    course_details: v2Course(),
    description: faker.lorem.sentences(2),
    effort: `${faker.number.int({ min: 1, max: 10 })} hours per week`,
    faculty: Array.from({ length: faker.number.int({ min: 1, max: 3 }) }, () =>
      faculty(),
    ),
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
    prerequisites: makeHTMLList(2),
    price: [priceItem()],
    title: faker.lorem.words(3),
    topic_list: [
      {
        name: faker.lorem.word(),
        parent: faker.lorem.word(),
      },
    ],
    video_url: faker.internet.url(),
    what_you_learn: makeHTMLList(5),
  }
  return mergeOverrides<CoursePageItem>(defaults, override)
}

const coursePageList: PartialFactory<CoursePageList> = (override) => {
  const defaults: CoursePageList = {
    meta: { total_count: 1 },
    items: [coursePageItem()],
  }
  return mergeOverrides<CoursePageList>(defaults, override)
}

export { coursePageItem, coursePageList }
