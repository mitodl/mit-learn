import { faker } from "@faker-js/faker/locale/en"
import { mergeOverrides, type PartialFactory } from "ol-test-utilities"
import {
  DashboardResourceType,
  EnrollmentMode,
  EnrollmentStatus,
} from "./types"
import type { DashboardCourse } from "./types"

const dashboardCourse: PartialFactory<DashboardCourse> = (...overrides) => {
  return mergeOverrides<DashboardCourse>(
    {
      id: faker.string.uuid(),
      type: DashboardResourceType.Course,
      title: faker.commerce.productName(),
      marketingUrl: faker.internet.url(),
      run: {
        startDate: faker.date.past().toISOString(),
        endDate: faker.date.future().toISOString(),
        certificateUpgradeDeadline: faker.date.future().toISOString(),
        certificateUpgradePrice: faker.commerce.price(),
        canUpgrade: true,
        coursewareUrl: faker.internet.url(),
      },
      enrollment: {
        status: faker.helpers.arrayElement(Object.values(EnrollmentStatus)),
        mode: faker.helpers.arrayElement(Object.values(EnrollmentMode)),
      },
    },
    ...overrides,
  )
}

export { dashboardCourse }
