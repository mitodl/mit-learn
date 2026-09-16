import React from "react"
import { setMockResponse, urls } from "api/test-utils"
import { renderWithProviders, screen, waitFor } from "@/test-utils"
import ProductPageTemplate from "./ProductPageTemplate"
import { STAY_UPDATED_FORM_ID } from "./test-utils/stayUpdated"
import type { ResourceInfo } from "./ProductPageTemplate"

const DEFAULT_RESOURCE: ResourceInfo = {
  readable_id: "program-v1:default+test",
  resource_type: "program",
}

/**
 * Unlike the sibling suite, this file does NOT mock `useHubspotFormDetail`, so
 * the request runs through React Query. A misconfigured form id in the CMS
 * makes HubSpot return a 4xx; the global query client throws on some codes,
 * which would render a full-page error. The button must instead be hidden and
 * the product page must keep rendering.
 */
describe("ProductPageTemplate stay-updated form-detail error handling", () => {
  it("keeps rendering the page and hides the button when the form detail request returns 400", async () => {
    setMockResponse.get(urls.userMe.get(), { is_authenticated: false })
    setMockResponse.get(
      urls.hubspot.details({ form_id: STAY_UPDATED_FORM_ID }),
      { detail: "Bad form id", code: "VALIDATION_ERROR" },
      { code: 400 },
    )

    renderWithProviders(
      <ProductPageTemplate
        currentBreadcrumbLabel="Programs"
        title="Sample Program"
        shortDescription="Program description"
        imageSrc="/test-image.jpg"
        infoBox={<div>Info box</div>}
        enrollmentAction={<button type="button">Enroll</button>}
        resource={DEFAULT_RESOURCE}
        hubspotFormId={STAY_UPDATED_FORM_ID}
      >
        <div>Page content</div>
      </ProductPageTemplate>,
    )

    expect(await screen.findByText("Sample Program")).toBeInTheDocument()

    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "Stay Updated" }),
      ).not.toBeInTheDocument()
    })
  })
})
