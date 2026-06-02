import {
  getCertificateBadgeLines,
  getCertificateInfo,
} from "./certificateUtils"

describe("getCertificateInfo", () => {
  it("returns default certificate label when no program type is provided", () => {
    expect(getCertificateInfo().displayType).toBe("Certificate")
  })

  it("returns MicroMasters badge label for micromasters program types", () => {
    expect(getCertificateInfo("MicroMasters®").displayType).toBe(
      "MicroMasters® Certificate",
    )
    expect(getCertificateInfo("  MicroMasters®  ").displayType).toBe(
      "MicroMasters® Certificate",
    )
    expect(getCertificateInfo("MicroMasters Credential").displayType).toBe(
      "MicroMasters® Certificate",
    )
  })

  it("does not match unrelated program types containing micro and master substrings", () => {
    expect(getCertificateInfo("Microbiology Masters").displayType).toBe(
      "Certificate",
    )
  })

  it("returns series badge label for series program types", () => {
    expect(getCertificateInfo("Series").displayType).toBe("Series Certificate")
  })

  it("returns program badge label for program program types", () => {
    expect(getCertificateInfo("Program").displayType).toBe(
      "Program Certificate",
    )
  })

  it("falls back to default label for unrecognized program types", () => {
    expect(getCertificateInfo("Degree").displayType).toBe("Certificate")
  })
})

describe("getCertificateBadgeLines", () => {
  it("returns a single line for course certificates", () => {
    expect(getCertificateBadgeLines()).toEqual({ primary: "Certificate" })
  })

  it("splits MicroMasters into two lines with a registered mark", () => {
    expect(getCertificateBadgeLines("MicroMasters®")).toEqual({
      primary: "MicroMasters",
      secondary: "Certificate",
      registeredMark: true,
    })
  })

  it("splits series and program descriptors across two lines", () => {
    expect(getCertificateBadgeLines("Series")).toEqual({
      primary: "Series",
      secondary: "Certificate",
    })
    expect(getCertificateBadgeLines("Program")).toEqual({
      primary: "Program",
      secondary: "Certificate",
    })
  })

  it("keeps display type and badge lines in sync for the same program type", () => {
    const programType = "MicroMasters®"
    expect(getCertificateInfo(programType).displayType).toBe(
      "MicroMasters® Certificate",
    )
    expect(getCertificateBadgeLines(programType)).toEqual({
      primary: "MicroMasters",
      secondary: "Certificate",
      registeredMark: true,
    })
  })
})
