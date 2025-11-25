import { faker } from "@faker-js/faker/locale/en"
import type { ContractPage } from "@mitodl/mitxonline-api-axios/v2"
import { makePaginatedFactory } from "ol-test-utilities"

const contract = (overrides: Partial<ContractPage> = {}): ContractPage => ({
  id: faker.number.int(),
  active: true,
  contract_end: faker.date.future().toISOString(),
  contract_start: faker.date.past().toISOString(),
  description: faker.lorem.sentence(),
  integration_type: "non-sso" as const,
  name: faker.company.name(),
  organization: faker.number.int(),
  slug: faker.lorem.slug(),
  membership_type: faker.helpers.arrayElement(["managed", "unmanaged"]),
  welcome_message: faker.lorem.sentence(),
  welcome_message_extra: `<p>${faker.lorem.paragraph()}</p>`,
  programs: [],
  ...overrides,
})

const contracts = makePaginatedFactory(contract)

export { contract, contracts }
