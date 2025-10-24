import React from "react"
import { screen } from "@testing-library/react"
import { renderWithProviders, setMockResponse } from "@/test-utils"
import {
  factories as mitxOnlineFactories,
  urls as mitxOnlineUrls,
} from "api/mitxonline-test-utils"
import { OrganizationCards } from "./OrganizationCards"
import type {
  OrganizationPage,
  ContractPage,
} from "@mitodl/mitxonline-api-axios/v2"
import { useFeatureFlagEnabled } from "posthog-js/react"

jest.mock("posthog-js/react")
const mockedUseFeatureFlagEnabled = jest.mocked(useFeatureFlagEnabled)

describe("OrganizationCards", () => {
  beforeEach(() => {
    mockedUseFeatureFlagEnabled.mockReturnValue(true)
  })

  type SetupOptions = {
    organizations?: OrganizationPage[]
    contracts?: ContractPage[]
    isUserLoading?: boolean
  }

  const createOrganizations = (count: number): OrganizationPage[] => {
    return Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      name: `Test Organization ${i + 1}`,
      description: `Description for org ${i + 1}`,
      logo: `https://example.com/logo${i + 1}.png`,
      slug: `org-test-${i + 1}`,
      contracts: [],
    }))
  }

  const createContracts = (
    count: number,
    customContracts: Partial<ContractPage>[] = [],
  ): ContractPage[] => {
    const contracts = Array.from({ length: count }, (_, i) =>
      mitxOnlineFactories.contracts.contract({
        id: i + 1,
        name: `Contract ${i + 1}`,
        organization: 1, // Default to org 1
      }),
    )

    // Apply custom overrides
    customContracts.forEach((override, index) => {
      if (contracts[index]) {
        Object.assign(contracts[index], override)
      }
    })

    return contracts
  }

  const setup = ({ organizations = [], contracts = [] }: SetupOptions = {}) => {
    const mitxOnlineUser = mitxOnlineFactories.user.user({
      b2b_organizations: organizations,
    })

    // Mock user API response
    setMockResponse.get(mitxOnlineUrls.userMe.get(), mitxOnlineUser)

    // Mock contracts API response - contracts endpoint returns array directly
    setMockResponse.get(mitxOnlineUrls.contracts.contractsList(), contracts)

    return renderWithProviders(<OrganizationCards />)
  }

  afterEach(() => {
    jest.clearAllMocks()
  })

  it("renders nothing when user has no B2B organizations", () => {
    setup({ organizations: [] })

    expect(screen.queryByText(/As a member of/)).not.toBeInTheDocument()
  })

  it("renders organization cards when user has B2B organizations and contracts", async () => {
    const organizations = createOrganizations(2)
    const contracts = createContracts(2, [
      { organization: 1 },
      { organization: 2 },
    ])

    setup({ organizations, contracts })

    for (const org of organizations) {
      const elements = await screen.findAllByText((content, element) => {
        return (
          element?.textContent ===
          `As a member of ${org.name} you have access to:`
        )
      })
      expect(elements.length).toBeGreaterThan(0)
    }
  })

  it("displays organization logo", async () => {
    const organization: OrganizationPage = {
      id: 1,
      name: "Test Organization",
      description: "Test Description",
      logo: "https://example.com/logo1.png",
      slug: "org-test",
      contracts: [],
    }
    const contracts = [
      mitxOnlineFactories.contracts.contract({
        id: 1,
        organization: organization.id,
        name: "Contract 1",
      }),
    ]
    setup({ organizations: [organization], contracts })

    const image = await screen.findByAltText("")
    expect(image).toBeInTheDocument()
    // Next.js Image optimizes URLs, so we check that it contains the original URL
    expect(image).toHaveAttribute(
      "src",
      expect.stringContaining("example.com%2Flogo1.png"),
    )
  })

  describe("when organization has contracts", () => {
    it("renders contract cards with correct information", async () => {
      const organization: OrganizationPage = {
        id: 1,
        name: "Test Organization",
        description: "Test description",
        logo: "https://example.com/logo.png",
        slug: "org-test-org",
        contracts: [],
      }

      const contracts = createContracts(3, [
        { id: 1, name: "Contract 1", organization: 1 },
        { id: 2, name: "Contract 2", organization: 1 },
        { id: 3, name: "Contract 3", organization: 2 }, // Different org
      ])

      setup({ organizations: [organization], contracts })

      // Should only show contracts for the organization (contracts 1 and 2)
      // Each contract appears twice (mobile + desktop)
      expect(await screen.findAllByText("Contract 1")).toHaveLength(2)
      expect(screen.getAllByText("Contract 2")).toHaveLength(2)
      expect(screen.queryByText("Contract 3")).not.toBeInTheDocument()
    })

    it("renders Continue buttons with correct organization URLs", async () => {
      const organization: OrganizationPage = {
        id: 1,
        name: "Test Organization",
        description: "Test description",
        logo: "https://example.com/logo.png",
        slug: "org-test-org",
        contracts: [],
      }

      const contracts = createContracts(2, [
        { id: 1, name: "Contract 1", organization: 1 },
        { id: 2, name: "Contract 2", organization: 1 },
      ])

      setup({ organizations: [organization], contracts })

      const continueButtons = await screen.findAllByRole("link", {
        name: "Continue",
      })
      expect(continueButtons).toHaveLength(4) // 2 contracts × 2 screen sizes (mobile + desktop)

      continueButtons.forEach((button) => {
        expect(button).toHaveAttribute(
          "href",
          "/dashboard/organization/test-org",
        )
      })
    })

    it("renders cards for both mobile and desktop screen sizes", async () => {
      const organization: OrganizationPage = {
        id: 1,
        name: "Test Organization",
        description: "Test description",
        logo: "https://example.com/logo.png",
        slug: "org-test-org",
        contracts: [],
      }

      const contracts = createContracts(1, [
        { id: 1, name: "Contract 1", organization: 1 },
      ])

      setup({ organizations: [organization], contracts })

      // Each contract should render twice (mobile + desktop)
      const contractTexts = await screen.findAllByText("Contract 1")
      expect(contractTexts).toHaveLength(2)
    })
  })

  describe("when organization has no matching contracts", () => {
    it("renders organization header but no contract cards", async () => {
      const organization: OrganizationPage = {
        id: 1,
        name: "Test Organization",
        description: "Test description",
        logo: "https://example.com/logo.png",
        slug: "org-test-org",
        contracts: [],
      }

      // No contracts for this organization
      const contracts = createContracts(1, [
        { id: 1, name: "Other Org Contract", organization: 999 },
      ])

      setup({ organizations: [organization], contracts })

      const elements = await screen.findAllByText((content, element) => {
        return (
          element?.textContent ===
          "As a member of Test Organization you have access to:"
        )
      })
      expect(elements.length).toBeGreaterThan(0)

      expect(
        screen.queryByRole("link", { name: "Continue" }),
      ).not.toBeInTheDocument()
      expect(screen.queryByText("Other Org Contract")).not.toBeInTheDocument()
    })
  })

  describe("with multiple organizations", () => {
    it("renders all organizations with their respective contracts", async () => {
      const org1: OrganizationPage = {
        id: 1,
        name: "Organization One",
        description: "Test description",
        logo: "https://example.com/logo1.png",
        slug: "org-one",
        contracts: [],
      }
      const org2: OrganizationPage = {
        id: 2,
        name: "Organization Two",
        description: "Test description",
        logo: "https://example.com/logo2.png",
        slug: "org-two",
        contracts: [],
      }

      const contracts = createContracts(3, [
        { id: 1, name: "Org1 Contract 1", organization: 1 },
        { id: 2, name: "Org1 Contract 2", organization: 1 },
        { id: 3, name: "Org2 Contract 1", organization: 2 },
      ])

      setup({ organizations: [org1, org2], contracts })

      // Check organization headers
      const org1Elements = await screen.findAllByText((content, element) => {
        return (
          element?.textContent ===
          "As a member of Organization One you have access to:"
        )
      })
      expect(org1Elements.length).toBeGreaterThan(0)

      const org2Elements = screen.getAllByText((content, element) => {
        return (
          element?.textContent ===
          "As a member of Organization Two you have access to:"
        )
      })
      expect(org2Elements.length).toBeGreaterThan(0)

      // Check contracts are displayed under correct organizations
      await screen.findAllByText("Org1 Contract 1")
      expect(screen.getAllByText("Org1 Contract 1")).toHaveLength(2) // mobile + desktop
      expect(screen.getAllByText("Org1 Contract 2")).toHaveLength(2) // mobile + desktop
      expect(screen.getAllByText("Org2 Contract 1")).toHaveLength(2) // mobile + desktop

      // Check Continue button URLs point to correct organizations
      const org1Buttons = screen
        .getAllByRole("link", { name: "Continue" })
        .filter(
          (button) =>
            button.getAttribute("href") === "/dashboard/organization/one",
        )
      const org2Buttons = screen
        .getAllByRole("link", { name: "Continue" })
        .filter(
          (button) =>
            button.getAttribute("href") === "/dashboard/organization/two",
        )

      expect(org1Buttons).toHaveLength(4) // 2 contracts × 2 screen sizes
      expect(org2Buttons).toHaveLength(2) // 1 contract × 2 screen sizes
    })
  })

  describe("edge cases", () => {
    it("handles organization with undefined logo gracefully", async () => {
      const organization = mitxOnlineFactories.organizations.organization({
        id: 1,
        name: "Test Organization",
        logo: undefined,
        slug: "org-test-org",
      })
      const contracts = createContracts(1, [{ organization: 1 }])

      setup({ organizations: [organization], contracts })

      const elements = await screen.findAllByText((content, element) => {
        return (
          element?.textContent ===
          "As a member of Test Organization you have access to:"
        )
      })
      expect(elements.length).toBeGreaterThan(0)

      const image = screen.getByAltText("")
      expect(image).toBeInTheDocument() // Should use default graduate logo
    })

    it("handles slug transformation correctly (removes 'org-' prefix)", async () => {
      const organization: OrganizationPage = {
        id: 1,
        name: "Test Organization",
        description: "Test description",
        logo: "https://example.com/logo.png",
        slug: "org-my-company",
        contracts: [],
      }

      const contracts = createContracts(1, [
        { id: 1, name: "Test Contract", organization: 1 },
      ])

      setup({ organizations: [organization], contracts })

      const continueButtons = await screen.findAllByRole("link", {
        name: "Continue",
      })
      expect(continueButtons[0]).toHaveAttribute(
        "href",
        "/dashboard/organization/my-company",
      )
    })

    it("handles slug without 'org-' prefix", async () => {
      const organization: OrganizationPage = {
        id: 1,
        name: "Test Organization",
        description: "Test description",
        logo: "https://example.com/logo.png",
        slug: "my-company", // No 'org-' prefix
        contracts: [],
      }

      const contracts = createContracts(1, [
        { id: 1, name: "Test Contract", organization: 1 },
      ])

      setup({ organizations: [organization], contracts })

      const continueButtons = await screen.findAllByRole("link", {
        name: "Continue",
      })
      expect(continueButtons[0]).toHaveAttribute(
        "href",
        "/dashboard/organization/my-company",
      )
    })

    it("filters contracts correctly when none match organization ID", async () => {
      const organization: OrganizationPage = {
        id: 1,
        name: "Test Organization",
        description: "Test description",
        logo: "https://example.com/logo.png",
        slug: "org-test-org",
        contracts: [],
      }

      const contracts = createContracts(2, [
        { id: 1, name: "Other Org Contract 1", organization: 999 },
        { id: 2, name: "Other Org Contract 2", organization: 888 },
      ])

      setup({ organizations: [organization], contracts })

      const elements = await screen.findAllByText((content, element) => {
        return (
          element?.textContent ===
          "As a member of Test Organization you have access to:"
        )
      })
      expect(elements.length).toBeGreaterThan(0)

      expect(screen.queryByText("Other Org Contract 1")).not.toBeInTheDocument()
      expect(screen.queryByText("Other Org Contract 2")).not.toBeInTheDocument()
      expect(
        screen.queryByRole("link", { name: "Continue" }),
      ).not.toBeInTheDocument()
    })
  })
})
