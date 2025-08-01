import { faker } from "@faker-js/faker/locale/en"
import { OrganizationPage } from "@mitodl/mitxonline-api-axios/v2"
import { mergeOverrides } from "ol-test-utilities"

const organization = (
  overrides: Partial<OrganizationPage>,
): OrganizationPage => {
  const merged = mergeOverrides(
    {
      id: faker.number.int(),
      name: faker.company.name(),
      description: faker.lorem.paragraph(),
      logo: faker.image.url(),
      slug: faker.lorem.slug(),
      contracts: [],
    },
    overrides,
  )

  // Ensure all required fields are present and not undefined
  return {
    id: merged.id!,
    name: merged.name!,
    description: merged.description!,
    logo: merged.logo!,
    slug: merged.slug!,
    contracts: merged.contracts!,
  }
}

export { organization }
