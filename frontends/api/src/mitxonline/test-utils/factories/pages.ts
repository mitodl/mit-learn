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
  ProgramPageItem,
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

const uniqueFacultyId = new UniqueEnforcer()
const faculty: Factory<Faculty> = (override) => {
  return {
    feature_image_src: faker.image.urlLoremFlickr({ width: 640, height: 480 }),
    id: uniqueFacultyId.enforce(() => faker.number.int()),
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

const programPageItem: PartialFactory<ProgramPageItem> = (override) => {
  const defaults: ProgramPageItem = {
    id: uniquePageId.enforce(() => faker.number.int()),
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
      type: "cms.ProgramPage",
    },
    title: faker.lorem.words(3),
    description: makeHTMLParagraph(1),
    length: `${faker.number.int({ min: 1, max: 4 })} terms (${faker.number.int({ min: 6, max: 24 })} months)`,
    effort: `${faker.number.int({ min: 5, max: 20 })} hours per week`,
    min_weekly_hours: `${faker.number.int({ min: 5, max: 10 })}`,
    max_weekly_hours: `${faker.number.int({ min: 11, max: 20 })}`,
    min_weeks: faker.number.int({ min: 24, max: 48 }),
    max_weeks: faker.number.int({ min: 48, max: 96 }),
    price: [
      priceItem({
        value: {
          text: `$${faker.number.int({ min: 250, max: 1000 })} - $${faker.number.int({ min: 1000, max: 5000 })} per course`,
          link: "",
        },
      }),
    ],
    min_price: faker.number.int({ min: 1000, max: 2500 }),
    max_price: faker.number.int({ min: 2500, max: 10000 }),
    prerequisites: makeHTMLParagraph(1),
    faq_url: faker.internet.url(),
    about: makeHTMLParagraph(3),
    what_you_learn: makeHTMLList(5),
    feature_image: featureImage(),
    video_url: faker.datatype.boolean() ? faker.internet.url() : null,
    faculty_section_title: "Meet your instructors",
    faculty: Array.from({ length: faker.number.int({ min: 2, max: 6 }) }, () =>
      faculty(),
    ),
    certificate_page: {
      id: faker.number.int({ min: 100, max: 200 }),
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
      title: `Certificate For ${faker.lorem.words(3)}`,
      product_name: faker.lorem.words(3),
      CEUs: "",
      overrides: [],
      signatory_items: Array.from(
        { length: faker.number.int({ min: 3, max: 5 }) },
        () => ({
          name: faker.person.fullName(),
          title_1: faker.person.jobTitle(),
          title_2: faker.person.jobTitle(),
          title_3: "",
          organization: "Massachusetts Institute of Technology",
          signature_image: faker.image.urlLoremFlickr({
            width: 200,
            height: 100,
          }),
        }),
      ),
    },
    program_details: {
      title: faker.lorem.words(3),
      readable_id: `program-v1:${faker.lorem.slug()}`,
      id: faker.number.int({ min: 1, max: 100 }),
      courses: Array.from(
        { length: faker.number.int({ min: 3, max: 8 }) },
        () => faker.number.int({ min: 1, max: 50 }),
      ),
      collections: [],
      requirements: {
        courses: {
          required: Array.from(
            { length: faker.number.int({ min: 2, max: 4 }) },
            () => faker.number.int({ min: 1, max: 20 }),
          ),
          electives: Array.from(
            { length: faker.number.int({ min: 2, max: 5 }) },
            () => faker.number.int({ min: 21, max: 50 }),
          ),
        },
        programs: {
          required: [],
          electives: [],
        },
      },
      req_tree: [
        {
          data: {
            node_type: "operator",
            operator: "all_of",
            operator_value: null,
            program: faker.lorem.slug(),
            course: null,
            title: "Required Courses",
            elective_flag: false,
          },
          id: 1,
        },
        {
          data: {
            node_type: "operator",
            operator: "min_number_of",
            operator_value: "2",
            program: faker.lorem.slug(),
            course: null,
            title: "Elective Courses",
            elective_flag: true,
          },
          id: 2,
        },
      ],
      page: {
        feature_image_src: faker.image.urlLoremFlickr({
          width: 1134,
          height: 675,
        }),
        page_url: `/programs/${faker.lorem.slug()}/`,
        financial_assistance_form_url: faker.internet.url(),
        description: makeHTMLParagraph(1),
        live: true,
        length: `${faker.number.int({ min: 1, max: 4 })} terms (${faker.number.int({ min: 6, max: 24 })} months)`,
        effort: `${faker.number.int({ min: 5, max: 20 })} hours per week`,
        price: `$${faker.number.int({ min: 250, max: 1000 })} - $${faker.number.int({ min: 1000, max: 5000 })} per course`,
      },
      program_type: faker.helpers.arrayElement([
        "MicroMasters®",
        "Professional Certificate",
        "XSeries",
      ]),
      certificate_type: faker.helpers.arrayElement([
        "MicroMasters Credential",
        "Professional Certificate",
        "XSeries Certificate",
      ]),
      departments: [
        {
          name: faker.company.name(),
        },
      ],
      live: true,
      topics: Array.from(
        { length: faker.number.int({ min: 3, max: 7 }) },
        () => ({
          name: faker.lorem.word(),
        }),
      ),
      availability: faker.helpers.arrayElement(["anytime", "dated"]),
      start_date: faker.date.future().toISOString(),
      end_date: null,
      enrollment_start: null,
      enrollment_end: null,
      required_prerequisites: faker.datatype.boolean(),
      duration: `${faker.number.int({ min: 1, max: 4 })} terms (${faker.number.int({ min: 6, max: 24 })} months)`,
      min_weeks: faker.number.int({ min: 24, max: 48 }),
      max_weeks: faker.number.int({ min: 48, max: 96 }),
      min_price: faker.number.int({ min: 1000, max: 2500 }),
      max_price: faker.number.int({ min: 2500, max: 10000 }),
      time_commitment: `${faker.number.int({ min: 5, max: 20 })} hours per week`,
      min_weekly_hours: `${faker.number.int({ min: 5, max: 10 })}`,
      max_weekly_hours: `${faker.number.int({ min: 11, max: 20 })}`,
    },
  }
  return mergeOverrides<ProgramPageItem>(defaults, override)
}

export { coursePageItem, coursePageList, faculty, programPageItem }
