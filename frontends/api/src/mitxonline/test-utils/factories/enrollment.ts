import { faker } from "@faker-js/faker/locale/en"
import { mergeOverrides } from "ol-test-utilities"
import type { PartialFactory } from "ol-test-utilities"
import type {
  CourseRunEnrollment,
  Course,
  ProductFlexibilePrice,
} from "../../generated/v0"

const courseEnrollment: PartialFactory<CourseRunEnrollment> = (
  overrides = {},
) => {
  const title = faker.word.words(3)
  return mergeOverrides<CourseRunEnrollment>(
    {
      id: faker.number.int(),
      certificate: null,
      approved_flexible_price_exists: faker.datatype.boolean(),
      grades: [],
      enrollment_mode: faker.helpers.arrayElement(["audit", "verified"]),
      edx_emails_subscription: faker.datatype.boolean(),
      run: {
        id: faker.number.int(),
        title,
        start_date: faker.date.past().toISOString(),
        end_date: faker.date.future().toISOString(),
        upgrade_deadline: faker.date.future().toISOString(),
        is_upgradable: faker.datatype.boolean(),
        courseware_url: faker.internet.url(),
        products: [
          {
            id: faker.number.int(),
            price: faker.commerce.price(),
          } as ProductFlexibilePrice, // not fully implemented
        ],
        course: {
          id: faker.number.int(),
          title,
          page: {
            page_url: faker.internet.url(),
          } as Course["page"],
        } as Course,
      } as CourseRunEnrollment["run"],
    },
    overrides,
  )
}

// Not paginated
const courseEnrollments = (count: number): CourseRunEnrollment[] => {
  return new Array(count).fill(null).map(() => courseEnrollment())
}

export { courseEnrollment, courseEnrollments }
