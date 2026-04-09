import { faker } from "@faker-js/faker/locale/en"
import type { Factory } from "ol-test-utilities"
import type { HubspotFormDefinition } from "../../generated/v1"

const form: Factory<HubspotFormDefinition> = (overrides = {}) => ({
  id: faker.string.uuid(),
  name: faker.company.name(),
  form_type: "hubspot",
  created_at: faker.date.past().toISOString(),
  updated_at: faker.date.recent().toISOString(),
  archived: false,
  field_groups: [],
  ...overrides,
})

export { form }
