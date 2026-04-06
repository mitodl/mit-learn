import React from "react"
import { setMockResponse, urls } from "api/test-utils"
import { renderWithProviders, screen } from "@/test-utils"
import ProductPageTemplate from "./ProductPageTemplate"
import { useHubspotFormDetail } from "api/hooks/hubspot"

jest.mock("api/hooks/hubspot", () => ({
  ...jest.requireActual("api/hooks/hubspot"),
  useHubspotFormDetail: jest.fn(),
}))

const mockedUseHubspotFormDetail = jest.mocked(useHubspotFormDetail)

const STAY_UPDATED_FORM_ID = "4f423dc7-5b08-430b-a9fb-920b7f9597ed"

const renderProductPageTemplate = () => {
  setMockResponse.get(urls.userMe.get(), { is_authenticated: false })
  renderWithProviders(
    <ProductPageTemplate
      currentBreadcrumbLabel="Programs"
      title="Sample Program"
      shortDescription={"Program description"}
      imageSrc="/test-image.jpg"
      infoBox={<div>Info box</div>}
      enrollmentAction={<button type="button">Enroll</button>}
    >
      <div>Page content</div>
    </ProductPageTemplate>,
  )
}

describe("ProductPageTemplate stay-updated trigger", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_STAY_UPDATED_HUBSPOT_FORM_ID
  })

  it("hides the trigger button when stay-updated form id is missing", () => {
    mockedUseHubspotFormDetail.mockReturnValue({
      data: undefined,
    } as ReturnType<typeof useHubspotFormDetail>)

    renderProductPageTemplate()

    expect(
      screen.queryByRole("button", { name: "Stay Updated" }),
    ).not.toBeInTheDocument()
    expect(mockedUseHubspotFormDetail).toHaveBeenCalledWith(undefined)
  })

  it("hides the trigger button when the configured form is not returned", () => {
    process.env.NEXT_PUBLIC_STAY_UPDATED_HUBSPOT_FORM_ID = STAY_UPDATED_FORM_ID
    mockedUseHubspotFormDetail.mockReturnValue({
      data: undefined,
    } as ReturnType<typeof useHubspotFormDetail>)

    renderProductPageTemplate()

    expect(
      screen.queryByRole("button", { name: "Stay Updated" }),
    ).not.toBeInTheDocument()
    expect(mockedUseHubspotFormDetail).toHaveBeenCalledWith({
      form_id: STAY_UPDATED_FORM_ID,
    })
  })

  it("shows the trigger button when form id is configured and form data exists", () => {
    process.env.NEXT_PUBLIC_STAY_UPDATED_HUBSPOT_FORM_ID = STAY_UPDATED_FORM_ID
    mockedUseHubspotFormDetail.mockReturnValue({
      data: {
        id: STAY_UPDATED_FORM_ID,
        name: "Stay Updated",
        form_type: "hubspot",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
        archived: false,
        field_groups: [],
      },
    } as unknown as ReturnType<typeof useHubspotFormDetail>)

    renderProductPageTemplate()

    expect(
      screen.getByRole("button", { name: "Stay Updated" }),
    ).toBeInTheDocument()
  })
})
