import { getCertificateInfo } from "./certificateUtils"

describe("getCertificateInfo", () => {
  it("returns default certificate label when no program type is provided", () => {
    expect(getCertificateInfo().displayType).toBe("Certificate")
  })

  it("returns MicroMasters badge label for micromasters program types", () => {
    expect(getCertificateInfo("MicroMasters®").displayType).toBe(
      "MicroMasters® Certificate",
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
