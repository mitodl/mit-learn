import * as u from "./utils"

describe("capitalize", () => {
  it("Capitalizes the first letter of the the string", () => {
    expect(u.capitalize("hello world")).toBe("Hello world")
  })
  it("Does nothing to the empty string", () => {
    expect(u.capitalize("")).toBe("")
  })
})

describe("Initials", () => {
  it.each([
    { in: "ant bat cat", out: "AB" },
    { in: "dog Elephant frog", out: "DE" },
    { in: "goat", out: "G" },
    { in: "Horse", out: "H" },
    { in: "   iguana     jackal", out: "IJ" },
    { in: "", out: "" },
  ])("Gets the capitalized first letter of the first two words", (testcase) => {
    expect(u.initials(testcase.in)).toBe(testcase.out)
  })
})

describe("pluralize", () => {
  test("If 'plural' is not provided, appends an 's' iff count != 1", () => {
    expect(u.pluralize("dog", 0)).toBe("dogs")
    expect(u.pluralize("dog", 1)).toBe("dog")
    expect(u.pluralize("dog", 2)).toBe("dogs")
    expect(u.pluralize("dog", 500)).toBe("dogs")
  })

  test("If 'plural' is provided, returns it iff count != 1", () => {
    expect(u.pluralize("pup", 0, "puppies")).toBe("puppies")
    expect(u.pluralize("pup", 1, "puppies")).toBe("pup")
    expect(u.pluralize("pup", 2, "puppies")).toBe("puppies")
    expect(u.pluralize("pup", 500, "puppies")).toBe("puppies")
  })
})
