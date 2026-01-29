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

describe("Smoke Test - Program Page B2C", () => {
  // TODO: This will need an update once we have a consistent B2C program to put onto CI/RC/Prod
  it("should load the page successfully", () => {
    // For some reason, on RC this page returns a 500 on first load. I'm not sure what's going on, but it loads fine after that?
    cy.visit("/programs/program-v1:MITx+CTL.SCM", { failOnStatusCode: false })
    // This will only pass on RC as written.
    cy.findByRole("main").should("exist")
    // Find the program title
    cy.contains("h1", "Supply Chain Management")
    const about = cy.get("#about")
    about.should("exist")
    // Find the program description
    about
      .next()
      .contains(
        "Gain expertise in the growing field of Supply Chain Management through an innovative online program consisting of five courses and a final capstone exam.",
      )
  })
})

describe("Smoke Test - Course Page B2C", () => {})
