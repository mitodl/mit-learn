import { faker } from "@faker-js/faker/locale/en"
import type {
  V2CourseRunCertificate,
  V2ProgramCertificate,
} from "@mitodl/mitxonline-api-axios/v2"
import { PartialFactory } from "ol-test-utilities"

/**
 * VerifiableCredential type matching the structure defined in DigitalCredentialDialog.
 * This interface defines the structure of a VerifiableCredential (Open Badges v3.0).
 */
export interface VerifiableCredential {
  id: string
  type: string[]
  proof?: {
    type: string
    created: string
    proofValue: string
    cryptosuite: string
    proofPurpose: string
    verificationMethod: string
  }
  issuer: {
    id: string
    name: string
    type: string[]
    image?: {
      id: string
      type: string
      caption?: string
    }
  }
  "@context": string[]
  validFrom: string
  validUntil: string
  credentialSubject: {
    type: string[]
    identifier: Array<{
      salt: string
      type: string
      hashed: boolean
      identityHash: string
      identityType: string
    }>
    achievement: {
      id: string
      name: string
      type: string[]
      image?: {
        id: string
        type: string
        caption?: string
      }
      criteria?: {
        narrative: string
      }
      description: string
      achievementType: string
    }
    activityEndDate?: string
    activityStartDate?: string
  }
}

export const courseCertificate: PartialFactory<V2CourseRunCertificate> = (
  overrides = {},
) => {
  const base = {
    user: {
      id: faker.number.int(),
      name: faker.person.fullName(),
    },
    uuid: faker.string.uuid(),
    course_run: {
      id: faker.number.int(),
      course: {
        id: faker.number.int(),
        title: faker.lorem.words(),
      },
      start_date: faker.date.past().toISOString(),
      end_date: faker.date.future().toISOString(),
    },
    certificate_page: {
      id: faker.number.int(),
      title: faker.lorem.words(),
      product_name: faker.lorem.words(),
      CEUs: faker.number.int().toString(),
      signatory_items: [
        {
          name: faker.person.fullName(),
          title_1: faker.person.jobTitle(),
          title_2: faker.person.jobTitle(),
          title_3: faker.person.jobTitle(),
          organization: faker.company.name(),
          signature_image: faker.image.url(),
        },
        {
          name: faker.person.fullName(),
          title_1: faker.person.jobTitle(),
          title_2: faker.person.jobTitle(),
          title_3: faker.person.jobTitle(),
          organization: faker.company.name(),
          signature_image: faker.image.url(),
        },
        {
          name: faker.person.fullName(),
          title_1: faker.person.jobTitle(),
          title_2: faker.person.jobTitle(),
          title_3: faker.person.jobTitle(),
          organization: faker.company.name(),
          signature_image: faker.image.url(),
        },
      ],
    },
    verifiable_credential_json: verifiableCredential(),
  }

  return { ...base, ...overrides } as V2CourseRunCertificate
}

export const programCertificate: PartialFactory<V2ProgramCertificate> = (
  overrides = {},
) => {
  const base = {
    user: {
      id: faker.number.int(),
      name: faker.person.fullName(),
    },
    uuid: faker.string.uuid(),
    program: {
      id: faker.number.int(),
      title: faker.lorem.words(),
      start_date: faker.date.past().toISOString(),
      end_date: faker.date.future().toISOString(),
    },
    certificate_page: {
      id: faker.number.int(),
      title: faker.lorem.words(),
      product_name: faker.lorem.words(),
      CEUs: faker.number.int().toString(),
      signatory_items: [
        {
          name: faker.person.fullName(),
          title_1: faker.person.jobTitle(),
          title_2: faker.person.jobTitle(),
          organization: faker.company.name(),
          signature_image: faker.image.url(),
        },
        {
          name: faker.person.fullName(),
          title_1: faker.person.jobTitle(),
          title_2: faker.person.jobTitle(),
          organization: faker.company.name(),
          signature_image: faker.image.url(),
        },
        {
          name: faker.person.fullName(),
          title_1: faker.person.jobTitle(),
          title_2: faker.person.jobTitle(),
          organization: faker.company.name(),
          signature_image: faker.image.url(),
        },
      ],
    },
    verifiable_credential_json: verifiableCredential(),
  }

  return { ...base, ...overrides } as V2ProgramCertificate
}

export const verifiableCredential: PartialFactory<VerifiableCredential> = (
  overrides = {},
) => {
  const base: VerifiableCredential = {
    id: `https://example.com/credentials/${faker.string.uuid()}`,
    type: ["VerifiableCredential", "OpenBadgeCredential"],
    proof: {
      type: "DataIntegrityProof",
      created: faker.date.past().toISOString(),
      proofValue: `z${faker.string.alphanumeric(16)}`,
      cryptosuite: "eddsa-rdfc-2022",
      proofPurpose: "assertionMethod",
      verificationMethod: `https://example.com/keys/${faker.number.int()}`,
    },
    issuer: {
      id: "https://example.com/issuer",
      name: "MIT Open Learning",
      type: ["Profile"],
    },
    "@context": [
      "https://www.w3.org/2018/credentials/v1",
      "https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json",
    ],
    validFrom: faker.date.past().toISOString(),
    validUntil: faker.date.future().toISOString(),
    credentialSubject: {
      type: ["AchievementSubject"],
      identifier: [
        {
          salt: faker.string.alphanumeric(6),
          type: "IdentityHash",
          hashed: true,
          identityHash: faker.person.fullName(),
          identityType: "email",
        },
      ],
      achievement: {
        id: `https://example.com/achievements/${faker.number.int()}`,
        name: faker.lorem.words(3),
        type: ["Achievement"],
        description: faker.lorem.sentence(),
        achievementType: "Certificate",
        criteria: {
          narrative: faker.lorem.sentence(),
        },
      },
    },
  }

  return { ...base, ...overrides } as VerifiableCredential
}
