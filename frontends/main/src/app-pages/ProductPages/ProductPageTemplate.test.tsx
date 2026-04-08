import React from "react"
import { setMockResponse, urls } from "api/test-utils"
import { renderWithProviders, screen } from "@/test-utils"
import ProductPageTemplate from "./ProductPageTemplate"
import { useHubspotFormDetail } from "api/hooks/hubspot"
import NiceModal from "@ebay/nice-modal-react"

jest.mock("api/hooks/hubspot", () => ({
  ...jest.requireActual("api/hooks/hubspot"),
  useHubspotFormDetail: jest.fn(),
}))

jest.mock("@ebay/nice-modal-react", () => {
  const actual = jest.requireActual("@ebay/nice-modal-react")
  return {
    ...actual,
    __esModule: true,
    default: {
      ...actual.default,
      show: jest.fn(),
    },
  }
})

const mockedUseHubspotFormDetail = jest.mocked(useHubspotFormDetail)
const mockedNiceModalShow = NiceModal.show as jest.MockedFunction<
  typeof NiceModal.show
>

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
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_STAY_UPDATED_HUBSPOT_FORM_ID
    mockedUseHubspotFormDetail.mockReset()
  })

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_STAY_UPDATED_HUBSPOT_FORM_ID
  })

  it("hides the trigger button when stay-updated form id is missing", () => {
    mockedUseHubspotFormDetail.mockReturnValue({
      data: undefined,
      isError: false,
    } as ReturnType<typeof useHubspotFormDetail>)

    renderProductPageTemplate()

    expect(
      screen.queryByRole("button", { name: "Stay Updated" }),
    ).not.toBeInTheDocument()
    expect(mockedUseHubspotFormDetail).toHaveBeenCalledWith(undefined)
  })

  it("shows the trigger button but click handler is not attached when form not yet fetched", () => {
    process.env.NEXT_PUBLIC_STAY_UPDATED_HUBSPOT_FORM_ID = STAY_UPDATED_FORM_ID
    mockedUseHubspotFormDetail.mockReturnValue({
      data: undefined,
      isError: false,
    } as ReturnType<typeof useHubspotFormDetail>)

    renderProductPageTemplate()

    const button = screen.getByRole("button", { name: "Stay Updated" })
    expect(button).toBeInTheDocument()
    expect(button).toBeEnabled()

    button.click()
    expect(mockedNiceModalShow).not.toHaveBeenCalled()
  })

  it("disables the trigger button when form fetch errors", () => {
    process.env.NEXT_PUBLIC_STAY_UPDATED_HUBSPOT_FORM_ID = STAY_UPDATED_FORM_ID
    mockedUseHubspotFormDetail.mockReturnValue({
      data: undefined,
      isError: true,
    } as ReturnType<typeof useHubspotFormDetail>)

    renderProductPageTemplate()

    const button = screen.getByRole("button", { name: "Stay Updated" })
    expect(button).toBeInTheDocument()
    expect(button).toBeDisabled()
  })

  it("attaches click handler when form id is configured and form data exists", () => {
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
      isError: false,
    } as unknown as ReturnType<typeof useHubspotFormDetail>)

    renderProductPageTemplate()

    const button = screen.getByRole("button", { name: "Stay Updated" })
    expect(button).toBeInTheDocument()
    expect(button).toBeEnabled()

    button.click()
    expect(mockedNiceModalShow).toHaveBeenCalled()
  })
})
