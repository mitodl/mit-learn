import { faker } from "@faker-js/faker/locale/en"
import type { ContractPage } from "@mitodl/mitxonline-api-axios/v2"
import { makePaginatedFactory } from "ol-test-utilities"
import type { ContractCode } from "../../hooks/organizations"

const contract = (overrides: Partial<ContractPage> = {}): ContractPage => ({
  id: faker.number.int(),
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
  variant_options: overrides.variant_options ?? [],
})

const contracts = makePaginatedFactory(contract)

const contractCode = (overrides: Partial<ContractCode> = {}): ContractCode => ({
  id: faker.number.int(),
  code: faker.string.alphanumeric(12),
  is_redeemed: false,
  redeemed_by: null,
  redeemed_on: null,
  ...overrides,
})

export { contract, contracts, contractCode }
