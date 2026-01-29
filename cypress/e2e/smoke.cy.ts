describe("Smoke Test - Homepage", () => {
  it("should load the homepage successfully", () => {
    cy.visit("/")
    cy.findByRole("main").should("exist")
    // Quite slow, defaults to 4s, but waiting for this to pop in on my local takes significantly longer
    // This does eventually work, but I should definitely talk to someone who knows the frontend better.
    cy.contains("Log In", { timeout: 20000 })
  })

  it("should have correct page title", () => {
    cy.visit("/")
    cy.title().should("not.be.empty")
  })
})
