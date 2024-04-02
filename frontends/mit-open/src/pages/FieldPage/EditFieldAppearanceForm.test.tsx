import {
  renderTestApp,
  screen,
  fireEvent,
  user,
  waitFor,
} from "../../test-utils"
import { fields as factory } from "api/test-utils/factories"
import { urls, setMockResponse } from "api/test-utils"
import { makeFieldViewPath, makeFieldEditPath } from "@/common/urls"
import { makeWidgetListResponse } from "ol-widgets/src/factories"
import type { PatchedFieldChannelWriteRequest } from "api/v0"

const setupApis = (
  fieldOverrides: Partial<PatchedFieldChannelWriteRequest>,
) => {
  const field = factory.field({ is_moderator: true, ...fieldOverrides })
  setMockResponse.get(urls.channels.details(field.id), field)
  setMockResponse.get(
    urls.widgetLists.details(field.widget_list || -1),
    makeWidgetListResponse({}, { count: 0 }),
  )
  return field
}

describe("EditFieldAppearanceForm", () => {
  it("Displays the field title, appearance inputs with current field values", async () => {
    const field = setupApis({})
    expect(field.is_moderator).toBeTruthy()
    renderTestApp({
      url: `${makeFieldEditPath(field.id.toString())}/#appearance`,
    })
    const descInput = (await screen.findByLabelText(
      "Description",
    )) as HTMLInputElement
    const titleInput = (await screen.findByLabelText(
      "Title",
    )) as HTMLInputElement
    expect(titleInput.value).toEqual(field.title)
    expect(descInput.value).toEqual(field.public_description)
  })

  it("Shows an error if a required field is blank", async () => {
    const field = setupApis({})
    renderTestApp({
      url: `${makeFieldEditPath(field.id.toString())}/#appearance`,
    })
    const titleInput = await screen.findByLabelText("Title")
    const titleError = screen.queryByText("Title is required.")
    expect(titleError).toBeNull()
    fireEvent.change(titleInput, {
      target: { value: "" },
    })
    fireEvent.blur(titleInput)
    await screen.findByText("Title is required.")
  })

  it("updates field values on form submission", async () => {
    const field = setupApis({
      featured_list: null, // so we don't have to mock userList responses
      lists: [],
    })
    const newTitle = "New Title"
    const newDesc = "New Description"
    // Initial field values
    const updatedValues = {
      ...field,
      title: newTitle,
      public_description: newDesc,
    }
    setMockResponse.patch(urls.channels.details(field.id), updatedValues)
    const { location } = renderTestApp({
      url: `${makeFieldEditPath(field.id.toString())}/#appearance`,
    })
    const titleInput = (await screen.findByLabelText(
      "Title",
    )) as HTMLInputElement
    const descInput = (await screen.findByLabelText(
      "Description",
    )) as HTMLInputElement
    const submitBtn = await screen.findByText("Save")
    titleInput.setSelectionRange(0, titleInput.value.length)
    await user.type(titleInput, newTitle)
    descInput.setSelectionRange(0, descInput.value.length)
    await user.type(descInput, newDesc)
    // Expected field values after submit
    setMockResponse.get(urls.channels.details(field.id), updatedValues)
    await user.click(submitBtn)

    await waitFor(() => {
      expect(location.current.pathname).toBe(
        makeFieldViewPath(field.channel_type, field.name),
      )
    })
    await screen.findByText(newTitle)
    await screen.findByText(newDesc)
  })
})
