/**
 * Local ESLint plugin for custom rules
 */

const requireQueryClientFetch = require("./require-query-client-fetch")

module.exports = {
  rules: {
    "require-query-client-fetch": requireQueryClientFetch,
  },
}
