import { faker } from "@faker-js/faker/locale/en"
import type {
  BulkAssignError,
  BulkAssignResult,
  ContractPage,
  ManagerEnrollmentCode,
  PaginatedManagerEnrollmentCodeList,
} from "@mitodl/mitxonline-api-axios/v2"
import { makePaginatedFactory } from "ol-test-utilities"

const contract = (overrides: Partial<ContractPage> = {}): ContractPage => ({
  id: faker.number.int(),
  contract_end: faker.date.future().toISOString(),
  contract_start: faker.date.past().toISOString(),
  description: faker.lorem.sentence(),
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

const paginatedContractCodes = (
  results: ManagerEnrollmentCode[],
  opts: { count?: number; next?: string | null; previous?: string | null } = {},
): PaginatedManagerEnrollmentCodeList => ({
  count: opts.count ?? results.length,
  next: opts.next ?? null,
  previous: opts.previous ?? null,
  results,
})

const contractCode = (
  overrides: Partial<ManagerEnrollmentCode> = {},
): ManagerEnrollmentCode => {
  const status = overrides.redemption_status ?? "assigned"
  const isAssigned = status !== "unassigned"
  const isRedeemed = status === "redeemed"
  return {
    id: faker.number.int(),
    code: faker.string.alphanumeric(12),
    redemption_status: status,
    assigned_to: isAssigned ? faker.internet.email() : null,
    assigned_on: isAssigned ? faker.date.past().toISOString() : null,
    assigned_name: isAssigned ? faker.person.fullName() : null,
    redeemed_by: isRedeemed ? faker.internet.email() : null,
    redeemed_on: isRedeemed ? faker.date.past().toISOString() : null,
    last_sent: null,
    ...overrides,
  }
}

const bulkAssignError = (
  overrides: Partial<BulkAssignError> = {},
): BulkAssignError => ({
  email: faker.internet.email(),
  name: faker.person.fullName(),
  detail: "Code has already been assigned or redeemed.",
  ...overrides,
})

const bulkAssignResult = (
  overrides: Partial<BulkAssignResult> = {},
): BulkAssignResult => ({
  assigned: [contractCode({ redemption_status: "assigned" })],
  errors: [],
  ...overrides,
})

export {
  contract,
  contracts,
  contractCode,
  paginatedContractCodes,
  bulkAssignError,
  bulkAssignResult,
}
