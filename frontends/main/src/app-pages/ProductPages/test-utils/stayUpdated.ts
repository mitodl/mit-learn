import { faker } from "@faker-js/faker/locale/en"

export const STAY_UPDATED_FORM_ID = faker.string.uuid()

/**
 * Sets the Stay Updated Hubspot form ID env var before each test and removes
 * it after. Call inside a describe block.
 */
export const useStayUpdatedEnv = () => {
  let previousFormId: string | undefined

  beforeEach(() => {
    previousFormId = process.env.NEXT_PUBLIC_STAY_UPDATED_HUBSPOT_FORM_ID
    process.env.NEXT_PUBLIC_STAY_UPDATED_HUBSPOT_FORM_ID = STAY_UPDATED_FORM_ID
  })

  afterEach(() => {
    if (previousFormId === undefined) {
      delete process.env.NEXT_PUBLIC_STAY_UPDATED_HUBSPOT_FORM_ID
    } else {
      process.env.NEXT_PUBLIC_STAY_UPDATED_HUBSPOT_FORM_ID = previousFormId
    }
  })
}
