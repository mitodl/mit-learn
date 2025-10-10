import React from "react"
import { factories } from "api/mitxonline-test-utils"

import {
  renderWithProviders,
  waitFor,
  screen,
  within,
  user,
} from "@/test-utils"

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

  const items = within(section).getAllByRole("listitem")

  expect(instructors.length).toBe(3)
  instructors.forEach((instructor, index) => {
    const item = items[index]
    within(item).getByRole("button", { name: instructor.instructor_name })
    within(item).getByText(instructor.instructor_title)
    getByImageSrc(item, instructor.feature_image_src)
  })
})

test("Opens and closes instructor dialog", async () => {
  const instructors = Array.from({ length: 3 }, () => makeFaculty())
  renderWithProviders(<InstructorsSection instructors={instructors} />)

  const instructor = faker.helpers.arrayElement(instructors)
  const button = screen.getByRole("button", {
    name: instructor.instructor_name,
  })
  await user.click(button)

  const dialog = await screen.findByRole("dialog", {
    name: `${instructor.instructor_name}`,
  })
  within(dialog).getByRole("heading", {
    level: 2,
    name: instructor.instructor_name,
  })
  expectRawContent(dialog, instructor.instructor_bio_long)

  const closeButton = within(dialog).getByRole("button", { name: "Close" })
  await user.click(closeButton)
  await waitFor(() => {
    expect(dialog).not.toBeInTheDocument()
  })
})
