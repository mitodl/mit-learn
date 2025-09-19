import React from "react"
import moment from "moment"
import { factories, setMockResponse } from "api/test-utils"
import { screen, renderWithProviders } from "@/test-utils"
import CertificatePage, { CertificateType } from "./CertificatePage"
import { urls } from "api/mitxonline-test-utils"

describe("CertificatePage", () => {
  it("renders a course certificate", async () => {
    const certificate = factories.mitxonline.courseCertificate()
    setMockResponse.get(
      urls.certificates.courseCertificatesRetrieve({
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
      urls.certificates.programCertificatesRetrieve({
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
})
