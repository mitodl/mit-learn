import { generateMetadata } from "./page"
import { factories, setMockResponse } from "api/test-utils"
import * as mitxonline from "api/mitxonline-test-utils"

type GenerateMetadataArgs = Parameters<typeof generateMetadata>[0]

const callGenerateMetadata = (certificateType: string, uuid: string) =>
  generateMetadata({
    params: Promise.resolve({ certificateType, uuid }),
    searchParams: Promise.resolve({}),
  } as GenerateMetadataArgs)

describe("Certificate page generateMetadata", () => {
  it("includes the MicroMasters descriptor for a MicroMasters program certificate", async () => {
    const certificate = factories.mitxonline.programCertificate()
    certificate.program.program_type = "MicroMasters®"
    setMockResponse.get(
      mitxonline.urls.certificates.programCertificatesRetrieve({
        cert_uuid: certificate.uuid,
      }),
      certificate,
    )

    const metadata = await callGenerateMetadata("program", certificate.uuid)

    expect(metadata.title).toContain(
      `${certificate.user.name}'s MicroMasters® Certificate`,
    )
    expect(metadata.description).toBe(
      `${certificate.user.name} has successfully completed: ${certificate.program.title}`,
    )
  })

  it("uses the plain Program descriptor for a Program certificate", async () => {
    const certificate = factories.mitxonline.programCertificate()
    certificate.program.program_type = "Program"
    setMockResponse.get(
      mitxonline.urls.certificates.programCertificatesRetrieve({
        cert_uuid: certificate.uuid,
      }),
      certificate,
    )

    const metadata = await callGenerateMetadata("program", certificate.uuid)

    expect(metadata.title).toContain(
      `${certificate.user.name}'s Program Certificate`,
    )
  })

  it("omits a program descriptor for a course certificate", async () => {
    const certificate = factories.mitxonline.courseCertificate()
    setMockResponse.get(
      mitxonline.urls.certificates.courseCertificatesRetrieve({
        cert_uuid: certificate.uuid,
      }),
      certificate,
    )

    const metadata = await callGenerateMetadata("course", certificate.uuid)

    expect(metadata.title).toContain(`${certificate.user.name}'s Certificate`)
    expect(metadata.title).not.toContain("MicroMasters")
    expect(metadata.description).toBe(
      `${certificate.user.name} has successfully completed: ${certificate.course_run.course.title}`,
    )
  })
})
