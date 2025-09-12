import { faker } from "@faker-js/faker/locale/en"
import type {
  V2CourseRunCertificate,
  V2ProgramCertificate,
} from "@mitodl/mitxonline-api-axios/v2"
import { PartialFactory } from "ol-test-utilities"

export const courseCertificate: PartialFactory<V2CourseRunCertificate> = (
  overrides = {},
) => {
  const base = {
    user: {
      id: faker.number.int(),
      name: faker.person.fullName(),
    },
    uuid: faker.string.uuid(),
    course_run: {
      id: faker.number.int(),
      course: {
        id: faker.number.int(),
        title: faker.lorem.words(),
      },
      start_date: faker.date.past().toISOString(),
      end_date: faker.date.future().toISOString(),
    },
    certificate_page: {
      id: faker.number.int(),
      title: faker.lorem.words(),
      product_name: faker.lorem.words(),
      CEUs: faker.number.int().toString(),
      signatory_items: [
        {
          name: faker.person.fullName(),
          title_1: faker.person.jobTitle(),
          title_2: faker.person.jobTitle(),
          organization: faker.company.name(),
          signature_image: faker.image.url(),
        },
        {
          name: faker.person.fullName(),
          title_1: faker.person.jobTitle(),
          title_2: faker.person.jobTitle(),
          organization: faker.company.name(),
          signature_image: faker.image.url(),
        },
        {
          name: faker.person.fullName(),
          title_1: faker.person.jobTitle(),
          title_2: faker.person.jobTitle(),
          organization: faker.company.name(),
          signature_image: faker.image.url(),
        },
      ],
    },
  }

  return { ...base, ...overrides } as V2CourseRunCertificate
}

export const programCertificate: PartialFactory<V2ProgramCertificate> = (
  overrides = {},
) => {
  const base = {
    user: {
      id: faker.number.int(),
      name: faker.person.fullName(),
    },
    uuid: faker.string.uuid(),
    program: {
      id: faker.number.int(),
      title: faker.lorem.words(),
      start_date: faker.date.past().toISOString(),
      end_date: faker.date.future().toISOString(),
    },
    certificate_page: {
      id: faker.number.int(),
      title: faker.lorem.words(),
      product_name: faker.lorem.words(),
      CEUs: faker.number.int().toString(),
      signatory_items: [
        {
          name: faker.person.fullName(),
          title_1: faker.person.jobTitle(),
          title_2: faker.person.jobTitle(),
          organization: faker.company.name(),
          signature_image: faker.image.url(),
        },
        {
          name: faker.person.fullName(),
          title_1: faker.person.jobTitle(),
          title_2: faker.person.jobTitle(),
          organization: faker.company.name(),
          signature_image: faker.image.url(),
        },
        {
          name: faker.person.fullName(),
          title_1: faker.person.jobTitle(),
          title_2: faker.person.jobTitle(),
          organization: faker.company.name(),
          signature_image: faker.image.url(),
        },
      ],
    },
  }

  return { ...base, ...overrides } as V2ProgramCertificate
}
