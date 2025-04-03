import { faker } from "@faker-js/faker/locale/en"
import { mergeOverrides, type PartialFactory } from "ol-test-utilities"
import { DashboardResourceType, EnrollmentStatus } from "./types"
import type { DashboardCourse } from "./types"

const dashboardCourse: PartialFactory<DashboardCourse> = (overrides = {}) => {
  return mergeOverrides<DashboardCourse>(
    {
      id: faker.string.uuid(),
      type: DashboardResourceType.Course,
      data: {
        title: faker.commerce.productName(),
        startDate: faker.date.past().toISOString(),
        endDate: faker.date.future().toISOString(),
        certificateUpgradeDeadline: faker.date.future().toISOString(),
        certificateUpgradePrice: faker.commerce.price(),
        hasUpgraded: false,
        canUpgrade: true,
        enrollmentStatus: faker.helpers.arrayElement(
          Object.values(EnrollmentStatus),
        ),
        coursewareUrl: faker.internet.url(),
        marketingUrl: faker.internet.url(),
        ...overrides.data,
      },
    },
    overrides,
  )
}

export { dashboardCourse }
