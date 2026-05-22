import React from "react"
import { renderWithProviders, screen } from "@/test-utils"
import { setMockResponse } from "api/test-utils"
import { factories } from "api/mitxonline-test-utils"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { allowConsoleErrors } from "ol-test-utilities"
import { ForbiddenError } from "@/common/errors"
import ContractAdminPage from "./ContractAdminPage"

jest.mock("posthog-js/react", () => ({
  ...jest.requireActual("posthog-js/react"),
  useFeatureFlagEnabled: jest.fn(),
}))
const mockedUseFeatureFlagEnabled = jest.mocked(useFeatureFlagEnabled)

const API_BASE_URL = process.env.NEXT_PUBLIC_MITX_ONLINE_BASE_URL
const managerOrgsUrl = `${API_BASE_URL}/api/v0/b2b/manager/organizations/`
const managerContractDetailUrl = (orgId: number, contractId: number) =>
  `${API_BASE_URL}/api/v0/b2b/manager/organizations/${orgId}/contracts/${contractId}/`

const makeOrgWithContract = () => {
  const contract = factories.contracts.contract()
  const org = factories.organizations.organization({ contracts: [contract] })
  return { org, contract }
}

describe("ContractAdminPage", () => {
  beforeEach(() => {
    mockedUseFeatureFlagEnabled.mockReturnValue(undefined)
  })

  test("throws ForbiddenError when feature flag is explicitly false", () => {
    mockedUseFeatureFlagEnabled.mockReturnValue(false)
    allowConsoleErrors()

    expect(() =>
      renderWithProviders(
        <ContractAdminPage orgSlug="any-org" contractSlug="any-contract" />,
      ),
    ).toThrow(ForbiddenError)
  })

  test("renders nothing while feature flag is loading (undefined)", () => {
    mockedUseFeatureFlagEnabled.mockReturnValue(undefined)

    const { view } = renderWithProviders(
      <ContractAdminPage orgSlug="any-org" contractSlug="any-contract" />,
    )

    expect(view.container.firstChild).toBeNull()
  })

  test("shows 'Organization not found' when user is not a manager for the requested org", async () => {
    mockedUseFeatureFlagEnabled.mockReturnValue(true)

    const otherOrg = factories.organizations.organization({})
    setMockResponse.get(managerOrgsUrl, [otherOrg])

    renderWithProviders(
      <ContractAdminPage orgSlug="not-my-org" contractSlug="some-contract" />,
    )

    await screen.findByRole("heading", { name: "Organization not found" })
  })

  test("shows 'Contract not found' when org is found but contract slug does not match", async () => {
    mockedUseFeatureFlagEnabled.mockReturnValue(true)

    const { org } = makeOrgWithContract()
    setMockResponse.get(managerOrgsUrl, [org])

    renderWithProviders(
      <ContractAdminPage
        orgSlug={org.slug}
        contractSlug="wrong-contract-slug"
      />,
    )

    await screen.findByRole("heading", { name: "Contract not found" })
  })

  test("renders org name and contract name when flag is on and user is a manager", async () => {
    mockedUseFeatureFlagEnabled.mockReturnValue(true)

    const { org, contract } = makeOrgWithContract()
    setMockResponse.get(managerOrgsUrl, [org])
    setMockResponse.get(managerContractDetailUrl(org.id, contract.id), {
      ...contract,
      attachment_percentage: null,
      total_enrollments: 0,
      total_codes: 50,
    })

    renderWithProviders(
      <ContractAdminPage orgSlug={org.slug} contractSlug={contract.slug} />,
    )

    await screen.findByRole("heading", { name: org.name })
    expect(screen.getByText(contract.name)).toBeInTheDocument()
  })

  test("renders seat count from contract detail", async () => {
    mockedUseFeatureFlagEnabled.mockReturnValue(true)

    const { org, contract } = makeOrgWithContract()
    setMockResponse.get(managerOrgsUrl, [org])
    setMockResponse.get(managerContractDetailUrl(org.id, contract.id), {
      ...contract,
      attachment_percentage: null,
      total_enrollments: 12,
      total_codes: 75,
    })

    renderWithProviders(
      <ContractAdminPage orgSlug={org.slug} contractSlug={contract.slug} />,
    )

    await screen.findByText("75 seats")
  })
})
