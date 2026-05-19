import { pxToPt, getNameStyles } from "./utils"

jest.mock("@react-pdf/renderer", () => ({
  Document: "Document",
  Page: "Page",
  View: "View",
  Text: "Text",
  Svg: "Svg",
  G: "G",
  Path: "Path",
  Font: {
    register: jest.fn(),
    registerHyphenationCallback: jest.fn(),
  },
  Image: "Image",
  pdf: jest.fn(),
}))

describe("Certificate PDF", () => {
  describe("pxToPt", () => {
    it("converts pixels to points correctly", () => {
      expect(pxToPt(96)).toBeCloseTo(57.6) // 96 * (72/96) * 0.8
      expect(pxToPt(52)).toBeCloseTo(31.2) // 52 * 0.75 * 0.8
      expect(pxToPt(206)).toBeCloseTo(123.6)
      expect(pxToPt(950)).toBeCloseTo(570)
    })
  })

  describe("Name scaling to ensure page fit", () => {
    const baseFontSize = pxToPt(52)
    const baselineTop = pxToPt(206)

    it("keeps short names <= 23 chars at full size", () => {
      const shortName = "Wolfgang Amadeus Mozart"
      const styles = getNameStyles(shortName)

      expect(styles.fontSize).toBeCloseTo(baseFontSize)
      expect(styles.top).toBeCloseTo(baselineTop)
    })

    it("scales medium-length names <= 33 chars proportionally", () => {
      const mediumName = "Sir Bartholomew Fizzlewhisk III"
      const styles = getNameStyles(mediumName)

      expect(styles.fontSize).toBeLessThan(baseFontSize)
      expect(styles.fontSize).toBeGreaterThan(baseFontSize * 0.35)

      expect(styles.top).toBeGreaterThan(baselineTop)
    })

    it("scales longer names <= 47 chars more aggressively", () => {
      const longName = "Dr. Maximilian Thunderbolt von Schnitzelhausen"
      const styles = getNameStyles(longName)

      expect(styles.fontSize).toBeLessThan(baseFontSize)
      expect(styles.top).toBeGreaterThan(baselineTop)

      const mediumName = "Sir Bartholomew Fizzlewhisk III"
      const mediumStyles = getNameStyles(mediumName)
      expect(styles.fontSize).toBeLessThan(mediumStyles.fontSize)
    })

    it("applies minimum scale factor of 35% for very long names <= 112 chars", () => {
      const veryLongName =
        "His Excellency Count Maximilian Cornelius Archibald Pumpernickel-Wigglesworth-Thunderbolt-Whiskerdoodle III"
      const styles = getNameStyles(veryLongName)

      const minFontSize = baseFontSize * 0.35
      expect(styles.fontSize).toBeCloseTo(minFontSize)

      const maxOffset = baseFontSize - minFontSize
      expect(styles.top).toBeCloseTo(baselineTop + maxOffset)
    })

    it("maintains baseline alignment when scaling names", () => {
      const names = [
        "Wolfgang Amadeus Mozart",
        "Sir Bartholomew Fizzlewhisk III",
        "Princess Anastasia Beauregard-Winterstone",
        "Dr. Maximilian Thunderbolt von Schnitzelhausen",
        "Captain Cornelius Pumpernickel-Whiskerdoodle Jones",
        "Lady Penelope Wigglesworth-Featherstone de la Fontaine",
        "Professor Archibald Bartholomew Higginbotham-Waffletop IV",
      ]

      names.forEach((name) => {
        const styles = getNameStyles(name)

        // The baseline position should be consistent: baseline = top + fontSize
        const baseline = styles.top + styles.fontSize
        expect(baseline).toBeCloseTo(baselineTop + baseFontSize, 1)
      })
    })
  })
})
