import React from "react"
import { faker } from "@faker-js/faker/locale/en"
import { factories } from "api/test-utils"
import { CourseResourceDeliveryInnerCodeEnum, ResourceTypeEnum } from "api"
import { RiFileCopy2Line } from "@remixicon/react"
import { LocalDate } from "ol-utilities"
import { learningResourceCardContent } from "./learningResourceCardContent"

const {
  course,
  resource,
  video,
  learningPath,
  run: makeRun,
  contentFile,
} = factories.learningResources

describe("learningResourceCardContent", () => {
  test("Maps the title, type label, and language", () => {
    const language = faker.lorem.word()
    const resource = course({ runs: [makeRun({ languages: [language] })] })

    const content = learningResourceCardContent(resource)

    expect(content.title).toBe(resource.title)
    expect(content.typeLabel).toBe(resource.resource_category)
    expect(content.lang).toBe(language)
  })

  test("Names the parent course when the resource has one", () => {
    const file = contentFile({
      run_title: faker.lorem.words(),
      course_number: [faker.lorem.word()],
    })
    const resource = video({ content_files: [file] })

    expect(learningResourceCardContent(resource).parentCourseName).toBe(
      `${file.course_number?.[0]}: ${file.run_title}`,
    )
  })

  test("Uses the resource's image over its content file's", () => {
    const resource = video({
      content_files: [contentFile({ image_src: faker.image.url() })],
    })

    expect(learningResourceCardContent(resource).imageSrc).toBe(
      resource.image?.url,
    )
  })

  test("Falls back to the content file's image when the resource has none", () => {
    const file = contentFile({ image_src: faker.image.url() })
    const resource = video({ image: null, content_files: [file] })

    expect(learningResourceCardContent(resource).imageSrc).toBe(file.image_src)
  })

  test("Documents, and only documents, get the document placeholder icon", () => {
    expect(
      learningResourceCardContent(
        resource({ resource_type: ResourceTypeEnum.Document }),
      ).placeholderIcon,
    ).toEqual(<RiFileCopy2Line />)
    expect(learningResourceCardContent(video()).placeholderIcon).toBeUndefined()
  })

  describe("metadata", () => {
    test("Lists item count, start date, and format, in that order", () => {
      const run = makeRun({ start_date: faker.date.future().toISOString() })
      const format = faker.lorem.words()
      const resource = learningPath({
        runs: [run],
        best_run_id: run.id,
        delivery: [
          { code: CourseResourceDeliveryInnerCodeEnum.Online, name: format },
        ],
      })

      expect(learningResourceCardContent(resource).metadata).toEqual([
        { label: "Items", value: resource.learning_path.item_count },
        {
          label: "Starts",
          value: <LocalDate date={run.start_date} format="MMM D, YYYY" />,
        },
        { label: "Format", value: format },
      ])
    })

    test("Anytime availability starts 'Anytime'", () => {
      const resource = course({ availability: "anytime" })

      expect(learningResourceCardContent(resource).metadata).toEqual([
        { label: "Starts", value: "Anytime" },
      ])
    })

    test("Omits items whose data is missing", () => {
      expect(learningResourceCardContent(course()).metadata).toEqual([])
    })
  })

  describe("price", () => {
    test("Paid with a certificate: the price on a dark panel, with the certificate type", () => {
      const resource = course({
        free: false,
        certification: true,
        resource_prices: [{ amount: "250", currency: "USD" }],
      })

      expect(learningResourceCardContent(resource).price).toEqual({
        tone: "dark",
        primary: "$250",
        certificate: resource.certification_type.name,
      })
    })

    test("Paid without a certificate has no certificate line", () => {
      const resource = course({ free: false, certification: false })

      expect(
        learningResourceCardContent(resource).price.certificate,
      ).toBeUndefined()
    })

    test("Paid with an unnamed certificate type reads 'Certificate'", () => {
      const paid = course({ free: false, certification: true })
      const resource = {
        ...paid,
        certification_type: { ...paid.certification_type, name: "" },
      }

      expect(learningResourceCardContent(resource).price.certificate).toBe(
        "Certificate",
      )
    })

    test("Free with a priced certificate is free to audit, naming the certificate type", () => {
      const resource = course({
        free: true,
        certification: true,
        resource_prices: [
          { amount: "0", currency: "USD" },
          { amount: "50", currency: "USD" },
        ],
      })

      expect(learningResourceCardContent(resource).price).toEqual({
        tone: "light",
        primary: "Free to audit",
        certificate: resource.certification_type.name,
        certificatePrice: "$50",
      })
    })

    test("Free with an unpriced certificate is free to audit", () => {
      const resource = course({
        free: true,
        certification: true,
        resource_prices: [{ amount: "0", currency: "USD" }],
      })

      expect(learningResourceCardContent(resource).price).toEqual({
        tone: "light",
        primary: "Free to audit",
        certificate: resource.certification_type.name,
      })
    })

    test("Free with an open license says so", () => {
      const resource = course({
        free: true,
        certification: false,
        license_cc: true,
      })

      expect(learningResourceCardContent(resource).price).toEqual({
        tone: "light",
        primary: "Free",
        license: "Open license",
      })
    })

    test("Free with neither certificate nor license reads 'Free'", () => {
      const resource = course({ free: true, certification: false })

      expect(learningResourceCardContent(resource).price).toEqual({
        tone: "light",
        primary: "Free",
      })
    })
  })
})
