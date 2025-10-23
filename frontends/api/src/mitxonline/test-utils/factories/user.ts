import { faker } from "@faker-js/faker/locale/en"
import { mergeOverrides, type PartialFactory } from "ol-test-utilities"
import type {
  User,
  LegalAddress,
  UserProfile,
  OrganizationPage,
} from "@mitodl/mitxonline-api-axios/v2"
import { UniqueEnforcer } from "enforce-unique"

const enforcerId = new UniqueEnforcer()

const legalAddress = (): LegalAddress => ({
  first_name: faker.person.firstName(),
  last_name: faker.person.lastName(),
  country: faker.location.countryCode(),
  state: faker.datatype.boolean() ? faker.location.state() : null,
})

const userProfile = (): UserProfile => ({
  gender: faker.helpers.arrayElement(["m", "f", "t", "nb", "o", ""]),
  year_of_birth: faker.number.int({ min: 1940, max: 2010 }),
  addl_field_flag: faker.datatype.boolean(),
  company: faker.company.name(),
  job_title: faker.person.jobTitle(),
  industry: faker.commerce.department(),
  job_function: faker.person.jobType(),
  company_size: faker.helpers.arrayElement([1, 9, 99, 999, 9999, 10000, 0]),
  years_experience: faker.helpers.arrayElement([2, 5, 10, 15, 20, 21, 0]),
  leadership_level: faker.person.jobDescriptor(),
  highest_education: faker.helpers.arrayElement([
    "Doctorate",
    "Master's or professional degree",
    "Bachelor's degree",
    "Associate degree",
    "Secondary/high school",
    "Junior secondary/junior high/middle school",
    "Elementary/primary school",
    "No formal education",
    "Other education",
    "",
  ]),
  type_is_student: faker.datatype.boolean(),
  type_is_professional: faker.datatype.boolean(),
  type_is_educator: faker.datatype.boolean(),
  type_is_other: faker.datatype.boolean(),
})

const userOrganization = (): OrganizationPage => ({
  id: faker.number.int(),
  name: faker.company.name(),
  description: faker.company.catchPhrase(),
  logo: faker.image.url(),
  slug: faker.helpers.slugify(faker.company.name()),
  contracts: [],
})

const user: PartialFactory<User> = (overrides = {}): User => {
  return mergeOverrides(
    {
      id: enforcerId.enforce(faker.number.int),
      username: faker.internet.username(),
      name: faker.person.fullName(),
      email: faker.internet.email(),
      legal_address: legalAddress(),
      user_profile: userProfile(),
      is_anonymous: false,
      is_authenticated: true,
      is_editor: faker.datatype.boolean(),
      is_staff: faker.datatype.boolean(),
      is_superuser: faker.datatype.boolean(),
      created_on: faker.date.past().toISOString(),
      updated_on: faker.date.recent().toISOString(),
      grants: [],
      is_active: true,
      b2b_organizations: [userOrganization()],
    },
    overrides,
  ) as User
}

export { user }
