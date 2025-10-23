import { faker } from "@faker-js/faker/locale/en"
import type { ContractPage } from "@mitodl/mitxonline-api-axios/v2"

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
  ...overrides,
})

const contracts = (
  options: { count?: number } = {},
): { results: ContractPage[] } => {
  const { count = 3 } = options
  return {
    results: Array.from({ length: count }, () => contract()),
  }
}

export { contract, contracts }
