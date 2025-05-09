export { default as ControlledPromise } from "./ControlledPromise/ControlledPromise"
export * from "./factories"
export * from "./mocks/mocks"
export * from "./assertions"

export * from "./domQueries/byImageSrc"
export * from "./domQueries/byTerm"
export * from "./domQueries/forms"

/**
 * This is moment-timezone.
 * It is an enormous package and should only be used for testing.
 */
import moment from "moment-timezone"
import { queryify } from "./querify"

/**
 * Use this to set the default timezone for momentjs during tests.
 */
const setDefaultTimezone = (timezone: string) => {
  moment.tz.setDefault(timezone)
}

export { setDefaultTimezone, queryify }
