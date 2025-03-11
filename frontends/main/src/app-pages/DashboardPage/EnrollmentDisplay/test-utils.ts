import { faker } from "@faker-js/faker/locale/en"
import type { Factory } from "ol-test-utilities"
import { EnrollmentType } from "./types"
import type { EnrollmentData } from "./types"

const enrollmentData: Factory<EnrollmentData> = (overrides = {}) => {
  return {
    type: EnrollmentType.Course,
    title: faker.word.words(3),
    id: faker.number.int().toString(),
    startDate: faker.date.past().toISOString(),
    endDate: faker.date.future().toISOString(),
    certificateUpgradeDeadline: faker.date.future().toISOString(),
    certificateUpgradePrice: faker.commerce.price(),
    hasUpgraded: faker.datatype.boolean(),
    canUpgrade: faker.datatype.boolean(),
    hasUserCompleted: faker.datatype.boolean(),
    coursewareUrl: faker.internet.url(),
    marketingUrl: faker.internet.url(),
    ...overrides,
  }
}

export { enrollmentData }
