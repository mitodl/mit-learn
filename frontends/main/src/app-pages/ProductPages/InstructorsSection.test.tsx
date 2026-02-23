import React from "react"
import { factories } from "api/mitxonline-test-utils"

import { renderWithProviders, screen, within, user } from "@/test-utils"

import { getByImageSrc } from "ol-test-utilities"

import { faker } from "@faker-js/faker/locale/en"
import InstructorsSection from "./InstructorsSection"

const makeFaculty = factories.pages.faculty

const expectRawContent = (el: HTMLElement, htmlString: string) => {
  const raw = within(el).getByTestId("raw")
  expect(htmlString.length).toBeGreaterThan(0)
  expect(raw.innerHTML).toBe(htmlString)
}

test("Renders each instructor", async () => {
  const instructors = Array.from({ length: 3 }, () => makeFaculty())
  renderWithProviders(<InstructorsSection instructors={instructors} />)

  const section = await screen.findByRole("region", {
    name: "Meet your instructors",
  })

  expect(instructors.length).toBe(3)
  instructors.forEach((instructor) => {
    const button = within(section).getByRole("button", {
      name: instructor.instructor_name,
    })
    getByImageSrc(button, instructor.feature_image_src)
  })

  const defaultInstructor = instructors[0]
  within(section).getByRole("heading", {
    name: defaultInstructor.instructor_name,
  })
  expectRawContent(section, defaultInstructor.instructor_bio_long)
})

test("Changes active instructor content on portrait click", async () => {
  const instructors = Array.from({ length: 3 }, () => makeFaculty())
  renderWithProviders(<InstructorsSection instructors={instructors} />)

  const instructor = faker.helpers.arrayElement(instructors)
  const button = screen.getByRole("button", {
    name: instructor.instructor_name,
  })
  await user.click(button)

  const section = await screen.findByRole("region", {
    name: "Meet your instructors",
  })
  within(section).getByRole("heading", {
    name: instructor.instructor_name,
  })
  expectRawContent(section, instructor.instructor_bio_long)

  expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
})
