import { faker } from "@faker-js/faker/locale/en"

/** A stable fake HubSpot form id shared across the product-page Stay Updated tests. */
export const STAY_UPDATED_FORM_ID = faker.string.uuid()

/** Returns a copy of a product page with `hubspot_form_id` set, for tests. */
export const withHubspotFormId = <T extends object>(
  page: T,
  hubspotFormId: string | null,
): T => ({ ...page, hubspot_form_id: hubspotFormId }) as T
