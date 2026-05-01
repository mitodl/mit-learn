import React from "react"
import { fireEvent } from "@testing-library/react"
import { setMockResponse, urls, factories } from "api/test-utils"
import { renderWithProviders, screen } from "@/test-utils"
import ProductPageTemplate from "./ProductPageTemplate"
import { StayUpdatedModal } from "./StayUpdatedModal"
import { useHubspotFormDetail } from "api/hooks/hubspot"
import NiceModal from "@ebay/nice-modal-react"
import { STAY_UPDATED_FORM_ID } from "./test-utils/stayUpdated"
import { usePostHog } from "posthog-js/react"
import { PostHogEvents } from "@/common/constants"
import type { ResourceInfo } from "./ProductPageTemplate"
import { PlatformEnum } from "api"
import { DEFAULT_RESOURCE_IMG } from "ol-utilities"
import { getAllByImageSrc, getByImageSrc } from "ol-test-utilities"

jest.mock("posthog-js/react", () => ({
  ...jest.requireActual("posthog-js/react"),
  usePostHog: jest.fn(),
}))
const mockCapture = jest.fn()
jest.mocked(usePostHog).mockReturnValue(
  // @ts-expect-error Not mocking all of posthog
  { capture: mockCapture },
)

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
const mockedNiceModalShow = jest.mocked(NiceModal.show)

const DEFAULT_RESOURCE: ResourceInfo = {
  readable_id: "program-v1:default+test",
  resource_type: "program",
}

const renderProductPageTemplate = (
  args: { showStayUpdated?: true; resource?: ResourceInfo } = {},
) => {
  const { showStayUpdated, resource = DEFAULT_RESOURCE } = args
  setMockResponse.get(urls.userMe.get(), { is_authenticated: false })
  renderWithProviders(
    <ProductPageTemplate
      currentBreadcrumbLabel="Programs"
      title="Sample Program"
      shortDescription={"Program description"}
      imageSrc="/test-image.jpg"
      infoBox={<div>Info box</div>}
      enrollmentAction={<button type="button">Enroll</button>}
      showStayUpdated={showStayUpdated ?? false}
      resource={resource}
    >
      <div>Page content</div>
    </ProductPageTemplate>,
  )
}

describe("ProductPageTemplate image error fallback", () => {
  it("falls back to DEFAULT_RESOURCE_IMG when imageSrc returns 404", () => {
    setMockResponse.get(urls.userMe.get(), { is_authenticated: false })
    const { view } = renderWithProviders(
      <ProductPageTemplate
        currentBreadcrumbLabel="Programs"
        title="Sample Program"
        shortDescription="Program description"
        imageSrc="https://example.com/image.jpg"
        infoBox={<div>Info box</div>}
        enrollmentAction={<button type="button">Enroll</button>}
        showStayUpdated={false}
        resource={DEFAULT_RESOURCE}
      >
        <div>Page content</div>
      </ProductPageTemplate>,
    )

    getAllByImageSrc(view.container, "https://example.com/image.jpg").forEach(
      (img) => fireEvent.error(img),
    )
    expect(
      getAllByImageSrc(view.container, DEFAULT_RESOURCE_IMG).length,
    ).toBeGreaterThan(0)
  })
})

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
    expect(mockedUseHubspotFormDetail).toHaveBeenCalledWith(undefined, {
      enabled: false,
    })
  })

  it("opens the modal when form id is configured even if the form is not yet fetched", () => {
    process.env.NEXT_PUBLIC_STAY_UPDATED_HUBSPOT_FORM_ID = STAY_UPDATED_FORM_ID
    mockedUseHubspotFormDetail.mockReturnValue({
      data: undefined,
      isError: false,
    } as ReturnType<typeof useHubspotFormDetail>)

    renderProductPageTemplate({ showStayUpdated: true })

    const button = screen.getByRole("button", { name: "Stay Updated" })
    expect(button).toBeInTheDocument()
    expect(button).toBeEnabled()

    button.click()
    expect(mockedNiceModalShow).toHaveBeenCalledWith(StayUpdatedModal, {
      productReadableId: DEFAULT_RESOURCE.readable_id,
    })
  })

  it("disables the trigger button when form fetch errors", () => {
    process.env.NEXT_PUBLIC_STAY_UPDATED_HUBSPOT_FORM_ID = STAY_UPDATED_FORM_ID
    mockedUseHubspotFormDetail.mockReturnValue({
      data: undefined,
      isError: true,
    } as ReturnType<typeof useHubspotFormDetail>)

    renderProductPageTemplate({ showStayUpdated: true })

    const button = screen.getByRole("button", { name: "Stay Updated" })
    expect(button).toBeInTheDocument()
    expect(button).toBeDisabled()
  })

  it("attaches click handler when form id is configured and form data exists", () => {
    process.env.NEXT_PUBLIC_STAY_UPDATED_HUBSPOT_FORM_ID = STAY_UPDATED_FORM_ID
    mockedUseHubspotFormDetail.mockReturnValue({
      data: factories.hubspot.form({
        id: STAY_UPDATED_FORM_ID,
        name: "Stay Updated",
      }),
      isError: false,
    } as unknown as ReturnType<typeof useHubspotFormDetail>)

    renderProductPageTemplate({ showStayUpdated: true })

    const button = screen.getByRole("button", { name: "Stay Updated" })
    expect(button).toBeInTheDocument()
    expect(button).toBeEnabled()

    button.click()
    expect(mockedNiceModalShow).toHaveBeenCalledWith(StayUpdatedModal, {
      productReadableId: DEFAULT_RESOURCE.readable_id,
    })
  })

  describe("PostHog tracking", () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_POSTHOG_API_KEY = "test-key"
      process.env.NEXT_PUBLIC_STAY_UPDATED_HUBSPOT_FORM_ID =
        STAY_UPDATED_FORM_ID
      mockedUseHubspotFormDetail.mockReturnValue({
        data: undefined,
        isError: false,
      } as ReturnType<typeof useHubspotFormDetail>)
    })

    afterEach(() => {
      delete process.env.NEXT_PUBLIC_POSTHOG_API_KEY
      mockCapture.mockReset()
    })

    it("fires cta_clicked with resource properties when Stay Updated is clicked", () => {
      const resource = {
        id: 42,
        readable_id: "program-v1:test+101",
        resource_type: "program" as const,
      }
      renderProductPageTemplate({ showStayUpdated: true, resource })

      screen.getByRole("button", { name: "Stay Updated" }).click()

      expect(mockCapture).toHaveBeenCalledWith(
        PostHogEvents.CallToActionClicked,
        {
          label: "Stay Updated",
          readableId: resource.readable_id,
          resourceType: resource.resource_type,
          platform: PlatformEnum.Mitxonline,
        },
      )
    })

    it("does not fire cta_clicked when NEXT_PUBLIC_POSTHOG_API_KEY is not set", () => {
      delete process.env.NEXT_PUBLIC_POSTHOG_API_KEY
      const resource = {
        id: 42,
        readable_id: "program-v1:test+101",
        resource_type: "program" as const,
      }
      renderProductPageTemplate({ showStayUpdated: true, resource })

      screen.getByRole("button", { name: "Stay Updated" }).click()

      expect(mockCapture).not.toHaveBeenCalled()
    })
  })
})
