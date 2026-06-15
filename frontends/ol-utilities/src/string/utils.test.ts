import * as u from "./utils"

describe("extractEmailsFromCsvRows", () => {
  const extract = u.extractEmailsFromCsvRows

  test("returns valid emails from single-column rows", () => {
    const { valid } = extract([["alice@example.com"], ["bob@example.com"]])
    expect(valid).toEqual(["alice@example.com", "bob@example.com"])
  })

  test("silently skips a header row with an 'email' column label", () => {
    const { valid, invalid, skippedCount } = extract([
      ["id", "name", "email"],
      ["1", "Alice", "alice@example.com"],
      ["2", "Bob", "bob@example.com"],
    ])
    expect(valid).toEqual(["alice@example.com", "bob@example.com"])
    expect(invalid).toEqual([])
    expect(skippedCount).toBe(0)
  })

  test("silently skips a single-column 'Email' header", () => {
    const { valid, skippedCount } = extract([
      ["Email"],
      ["alice@example.com"],
      ["bob@example.com"],
    ])
    expect(valid).toEqual(["alice@example.com", "bob@example.com"])
    expect(skippedCount).toBe(0)
  })

  test.each(["Email Address", "email_address", "e-mail", "E-Mail"])(
    "silently skips a header row with column label %s",
    (label) => {
      const { valid, skippedCount } = extract([[label], ["alice@example.com"]])
      expect(valid).toEqual(["alice@example.com"])
      expect(skippedCount).toBe(0)
    },
  )

  test("counts data rows with no @ as skipped (not header rows)", () => {
    const { valid, skippedCount } = extract([
      ["alice@example.com"],
      ["no-email-here"],
      ["bob@example.com"],
    ])
    expect(valid).toEqual(["alice@example.com", "bob@example.com"])
    expect(skippedCount).toBe(1)
  })

  test("finds email in any column, not just the first", () => {
    const { valid } = extract([
      ["1", "Alice Smith", "alice@example.com"],
      ["2", "Bob Jones", "bob@example.com"],
    ])
    expect(valid).toEqual(["alice@example.com", "bob@example.com"])
  })

  test("handles quoted fields with commas correctly when rows are pre-parsed", () => {
    // PapaParse handles quoting; by the time rows reach this function
    // each cell is already unquoted and clean.
    const { valid } = extract([
      ['"Smith, John"', "alice@example.com"],
      ["Bob Jones", "bob@example.com"],
    ])
    expect(valid).toEqual(["alice@example.com", "bob@example.com"])
  })

  test("collects values with @ that fail validation into invalid array", () => {
    const { valid, invalid } = extract([
      ["alice@example.com"],
      ["bad@"],
      ["not-quite@.com"],
    ])
    expect(valid).toEqual(["alice@example.com"])
    expect(invalid).toEqual(["bad@", "not-quite@.com"])
  })

  test("deduplicates emails case-insensitively and counts duplicates", () => {
    const { valid, duplicateCount } = extract([
      ["alice@example.com"],
      ["Alice@Example.COM"],
      ["bob@example.com"],
    ])
    expect(valid).toEqual(["alice@example.com", "bob@example.com"])
    expect(duplicateCount).toBe(1)
  })

  test("returns clean result with empty arrays for valid input", () => {
    const result = extract([["alice@example.com"], ["bob@example.com"]])
    expect(result).toEqual({
      valid: ["alice@example.com", "bob@example.com"],
      invalid: [],
      duplicateCount: 0,
      skippedCount: 0,
    })
  })

  test("returns empty valid array for empty input", () => {
    const { valid } = extract([])
    expect(valid).toEqual([])
  })

  test("returns empty valid and populates invalid when all rows fail", () => {
    const { valid, invalid } = extract([["bad@"], ["not-quite@.com"]])
    expect(valid).toEqual([])
    expect(invalid).toEqual(["bad@", "not-quite@.com"])
  })

  test("rejects single-label domains (no TLD)", () => {
    const { valid, invalid } = extract([
      ["alice@example.com"],
      ["emma@university"],
    ])
    expect(valid).toEqual(["alice@example.com"])
    expect(invalid).toContain("emma@university")
  })

  test("rejects leading dot in local part", () => {
    const { valid, invalid } = extract([
      ["alice@example.com"],
      [".leo@valid.com"],
    ])
    expect(valid).toEqual(["alice@example.com"])
    expect(invalid).toContain(".leo@valid.com")
  })
})

describe("parseEmailsForSubmit", () => {
  const parse = u.parseEmailsForSubmit

  test("returns valid and empty invalid for clean input", () => {
    const result = parse("alice@example.com, bob@example.com")
    expect(result).toEqual({
      valid: ["alice@example.com", "bob@example.com"],
      invalid: [],
      duplicateCount: 0,
      skippedCount: 0,
    })
  })

  test("separates invalid tokens into invalid array", () => {
    const { valid, invalid } = parse("alice@example.com\nbadtoken\nnot@valid@")
    expect(valid).toEqual(["alice@example.com"])
    expect(invalid).toContain("badtoken")
  })

  test("deduplicates valid emails case-insensitively", () => {
    const { valid, duplicateCount } = parse(
      "alice@example.com\nAlice@Example.COM\nbob@example.com",
    )
    expect(valid).toEqual(["alice@example.com", "bob@example.com"])
    expect(duplicateCount).toBe(1)
  })

  test("handles newline-separated input", () => {
    const { valid } = parse("alice@example.com\nbob@example.com")
    expect(valid).toEqual(["alice@example.com", "bob@example.com"])
  })

  test("returns empty arrays for blank input", () => {
    const result = parse("")
    expect(result).toEqual({
      valid: [],
      invalid: [],
      duplicateCount: 0,
      skippedCount: 0,
    })
  })
})

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
