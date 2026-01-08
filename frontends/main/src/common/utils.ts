import { OrganizationPage } from "@mitodl/mitxonline-api-axios/v2"

const isInEnum = <T extends string>(
  value: string,
  enumObject: Record<string, T>,
): value is T => {
  return Object.values(enumObject).includes(value as T)
}

const matchOrganizationBySlug =
  (orgSlug: string) => (organization: OrganizationPage) => {
    return organization.slug.replace("org-", "") === orgSlug
  }

export { isInEnum, matchOrganizationBySlug }
