import React from "react"
import moment from "moment"
import { factories, setMockResponse } from "api/test-utils"
import { screen, renderWithProviders, user } from "@/test-utils"
import CertificatePage, { CertificateType } from "./CertificatePage"
import SharePopover from "@/components/SharePopover/SharePopover"
import * as mitxonline from "api/mitxonline-test-utils"
import {
  FACEBOOK_SHARE_BASE_URL,
  TWITTER_SHARE_BASE_URL,
  LINKEDIN_SHARE_BASE_URL,
} from "@/common/urls"

describe("CertificatePage", () => {
  beforeEach(() => {
    const mitxUser = mitxonline.factories.user.user()
    setMockResponse.get(mitxonline.urls.userMe.get(), mitxUser)
  })

  it("renders a course certificate", async () => {
    const certificate = factories.mitxonline.courseCertificate()
    setMockResponse.get(
      mitxonline.urls.certificates.courseCertificatesRetrieve({
        cert_uuid: certificate.uuid,
      }),
      certificate,
    )
    renderWithProviders(
      <CertificatePage
        certificateType={CertificateType.Course}
        uuid={certificate.uuid}
        pageUrl={`https://${process.env.NEXT_PUBLIC_ORIGIN}/certificate/course/${certificate.uuid}`}
      />,
    )

    await screen.findAllByText(certificate.course_run.course.title)
    await screen.findAllByText("Module Certificate")
    await screen.findAllByText(certificate.user.name!)
    await screen.findAllByText(
      `${moment(certificate.course_run.start_date).format("MMM D, YYYY")} - ${moment(certificate.course_run.end_date).format("MMM D, YYYY")}`,
    )

    await screen.findAllByText(
      certificate.certificate_page.signatory_items[0].name,
    )
    await screen.findAllByText(
      certificate.certificate_page.signatory_items[0].title_1,
    )
    await screen.findAllByText(
      certificate.certificate_page.signatory_items[0].title_2,
    )
    await screen.findAllByText(
      certificate.certificate_page.signatory_items[0].title_3,
    )
    await screen.findAllByText(
      certificate.certificate_page.signatory_items[0].organization,
    )
    await screen.findAllByText(
      certificate.certificate_page.signatory_items[1].name,
    )
    await screen.findAllByText(
      certificate.certificate_page.signatory_items[1].title_1,
    )
    await screen.findAllByText(
      certificate.certificate_page.signatory_items[1].title_2,
    )
    await screen.findAllByText(
      certificate.certificate_page.signatory_items[1].organization,
    )
    await screen.findAllByText(
      certificate.certificate_page.signatory_items[2].name,
    )
    await screen.findAllByText(
      certificate.certificate_page.signatory_items[2].title_1,
    )
    await screen.findAllByText(
      certificate.certificate_page.signatory_items[2].title_2,
    )
    await screen.findAllByText(
      certificate.certificate_page.signatory_items[2].organization,
    )

    await screen.findAllByText(certificate.uuid)
  })

  it("renders a program certificate", async () => {
    const certificate = factories.mitxonline.programCertificate()
    setMockResponse.get(
      mitxonline.urls.certificates.programCertificatesRetrieve({
        cert_uuid: certificate.uuid,
      }),
      certificate,
    )
    renderWithProviders(
      <CertificatePage
        certificateType={CertificateType.Program}
        uuid={certificate.uuid}
        pageUrl={`https://${process.env.NEXT_PUBLIC_ORIGIN}/certificate/program/${certificate.uuid}`}
      />,
    )

    await screen.findAllByText(certificate.program.title)
    await screen.findAllByText(
      `${certificate.program.program_type} Certificate`,
    )
    await screen.findAllByText(certificate.user.name!)

    await screen.findAllByText(
      `Awarded ${certificate.certificate_page.CEUs} Continuing Education Units (CEUs)`,
    )
    await screen.findAllByText(
      `${moment(certificate.program.start_date).format("MMM D, YYYY")} - ${moment(certificate.program.end_date).format("MMM D, YYYY")}`,
    )

    await screen.findAllByText(certificate.uuid)
  })

  it("does not display buttons when certificate belongs to a different user", async () => {
    const certificateOwner = mitxonline.factories.user.user({ id: 1 })
    const loggedInUser = mitxonline.factories.user.user({ id: 2 })
    const certificate = factories.mitxonline.programCertificate({
      user: {
        id: certificateOwner.id,
        name: certificateOwner.name,
      },
    })

    setMockResponse.get(
      mitxonline.urls.certificates.programCertificatesRetrieve({
        cert_uuid: certificate.uuid,
      }),
      certificate,
    )
    setMockResponse.get(mitxonline.urls.userMe.get(), loggedInUser)

    renderWithProviders(
      <CertificatePage
        certificateType={CertificateType.Program}
        uuid={certificate.uuid}
        pageUrl={`https://${process.env.NEXT_PUBLIC_ORIGIN}/certificate/program/${certificate.uuid}`}
      />,
    )

    await screen.findAllByText(certificate.program.title)

    expect(
      screen.queryByRole("button", { name: "Download PDF" }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Share" }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Print" }),
    ).not.toBeInTheDocument()
  })

  it("displays buttons when certificate belongs to the current user", async () => {
    const loggedInUser = mitxonline.factories.user.user({ id: 1 })
    const certificate = factories.mitxonline.programCertificate({
      user: {
        id: loggedInUser.id,
        name: loggedInUser.name,
      },
    })

    setMockResponse.get(
      mitxonline.urls.certificates.programCertificatesRetrieve({
        cert_uuid: certificate.uuid,
      }),
      certificate,
    )
    setMockResponse.get(mitxonline.urls.userMe.get(), loggedInUser)

    renderWithProviders(
      <CertificatePage
        certificateType={CertificateType.Program}
        uuid={certificate.uuid}
        pageUrl={`https://${process.env.NEXT_PUBLIC_ORIGIN}/certificate/program/${certificate.uuid}`}
      />,
    )

    await screen.findAllByText(certificate.program.title)

    await screen.findByRole("button", { name: "Download PDF" })
    await screen.findByRole("button", { name: "Share" })
    await screen.findByRole("button", { name: "Print" })
  })
})

describe("CertificatePage - SharePopover", () => {
  const mockProps = {
    open: true,
    title: "Test Certificate",
    anchorEl: document.createElement("div"),
    onClose: jest.fn(),
    pageUrl: "https://example.com/certificate/123",
  }

  const mockWriteText = jest.fn()
  Object.assign(navigator, {
    clipboard: {
      writeText: mockWriteText,
    },
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders the SharePopover with correct content", () => {
    renderWithProviders(<SharePopover {...mockProps} />)

    expect(screen.getByText("Share on social")).toBeInTheDocument()
    expect(screen.getByText("Share a link")).toBeInTheDocument()
    expect(screen.getByDisplayValue(mockProps.pageUrl)).toBeInTheDocument()
    expect(screen.getByText("Copy Link")).toBeInTheDocument()
  })

  it("renders social media share links with correct URLs", () => {
    renderWithProviders(<SharePopover {...mockProps} />)

    const facebookHref = `${FACEBOOK_SHARE_BASE_URL}?u=${encodeURIComponent(mockProps.pageUrl)}`
    const twitterHref = `${TWITTER_SHARE_BASE_URL}?text=${encodeURIComponent(mockProps.title)}&url=${encodeURIComponent(mockProps.pageUrl)}`
    const linkedinHref = `${LINKEDIN_SHARE_BASE_URL}?url=${encodeURIComponent(mockProps.pageUrl)}`

    const facebookLink = screen.getByRole("link", { name: "Share on Facebook" })
    const twitterLink = screen.getByRole("link", { name: "Share on Twitter" })
    const linkedinLink = screen.getByRole("link", { name: "Share on LinkedIn" })

    expect(facebookLink).toHaveAttribute("href", facebookHref)
    expect(twitterLink).toHaveAttribute("href", twitterHref)
    expect(linkedinLink).toHaveAttribute("href", linkedinHref)

    expect(facebookLink).toHaveAttribute("target", "_blank")
    expect(twitterLink).toHaveAttribute("target", "_blank")
    expect(linkedinLink).toHaveAttribute("target", "_blank")
  })

  it("copies link to clipboard when copy button is clicked", async () => {
    renderWithProviders(<SharePopover {...mockProps} />)

    const copyButton = screen.getByRole("button", { name: "Copy Link" })
    await user.click(copyButton)

    expect(mockWriteText).toHaveBeenCalledWith(mockProps.pageUrl)
    screen.getByRole("button", { name: "Copied!" })
  })

  it("does not render when open is false", () => {
    renderWithProviders(<SharePopover {...mockProps} open={false} />)

    expect(screen.queryByText("Share on social")).not.toBeInTheDocument()
    expect(screen.queryByText("Share a link")).not.toBeInTheDocument()
  })
})
