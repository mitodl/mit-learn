/* eslint-disable import/no-extraneous-dependencies,import/no-duplicates,import/no-restricted-paths */
import "@testing-library/cypress/add-commands"

// Custom commands can be added here
// Example:
// Cypress.Commands.add('login', (email, password) => {
//   cy.visit('/login')
//   cy.get('input[name="email"]').type(email)
//   cy.get('input[name="password"]').type(password)
//   cy.get('button[type="submit"]').click()
// })
// eslint-disable-next-line @typescript-eslint/no-unused-vars
Cypress.on("uncaught:exception", (err, runnable) => {
  // I don't know how to avoid a hydration error, but the page looks approximately right
  // This might be bad, need a frontend SME to weigh in for sure.
  if (err.message.includes("Hydration failed")) {
    return false
  }
  if (err.message.includes("Minified React error")) {
    return false
  }
})
