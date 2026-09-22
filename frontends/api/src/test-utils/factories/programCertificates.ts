import { faker } from "@faker-js/faker/locale/en"
import type { Factory } from "ol-test-utilities"
import type { ProgramCertificate } from "../../generated/v0"

const programCertificate: Factory<ProgramCertificate> = (overrides = {}) => ({
  record_hash: faker.string.uuid(),
  program_title: faker.lorem.words(),
  user_full_name: faker.person.fullName(),
  user_email: faker.internet.email(),
  micromasters_program_id: faker.number.int(),
  mitxonline_program_id: faker.number.int(),
  program_letter_generate_url: new URL(faker.internet.url()).toString(),
  program_letter_share_url: new URL(faker.internet.url()).toString(),
  ...overrides,
})

export { programCertificate }
