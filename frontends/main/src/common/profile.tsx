import React from "react"
import * as yup from "yup"
import {
  CertificateDesiredEnum,
  CurrentEducationEnum,
  GoalsEnum,
  DeliveryEnum,
} from "api/v0"
import { SimpleSelectOption } from "ol-components"

/*
 * Display labels for the profile choices. Keyed on the generated enums so that
 * a new backend choice is a type error here until it has a label. The backend's
 * choice labels are API documentation, not UI copy, so the strings live here.
 */
const DELIVERY_LABELS: Record<DeliveryEnum, string> = {
  [DeliveryEnum.Online]: "Online",
  [DeliveryEnum.Hybrid]: "Hybrid",
  [DeliveryEnum.InPerson]: "In-Person",
  [DeliveryEnum.Offline]: "Offline",
}

const GOALS_LABELS: Record<GoalsEnum, string> = {
  [GoalsEnum.AcademicExcellence]: "Academic Boost",
  [GoalsEnum.CareerGrowth]: "Career Growth",
  [GoalsEnum.LifelongLearning]: "Lifelong Learning",
}

const CURRENT_EDUCATION_LABELS: Record<CurrentEducationEnum, string> = {
  [CurrentEducationEnum.Doctorate]: "Doctorate",
  [CurrentEducationEnum.MastersOrProfessionalDegree]:
    "Master's or professional degree",
  [CurrentEducationEnum.BachelorsDegree]: "Bachelor's degree",
  [CurrentEducationEnum.AssociateDegree]: "Associate degree",
  [CurrentEducationEnum.SecondaryHighSchool]: "Secondary/high school",
  [CurrentEducationEnum.JuniorSecondaryJuniorHighMiddleSchool]:
    "Junior secondary/junior high/middle school",
  [CurrentEducationEnum.NoFormalEducation]: "No formal education",
  [CurrentEducationEnum.OtherEducation]: "Other education",
}

const CERTIFICATE_DESIRED_LABELS: Record<CertificateDesiredEnum, string> = {
  [CertificateDesiredEnum.Yes]: "Yes, I am looking for a certificate",
  [CertificateDesiredEnum.No]: "No, I am not looking for a certificate",
  [CertificateDesiredEnum.NotSureYet]: "Not Sure",
}

const DELIVERY_CHOICES = [
  DeliveryEnum.Online,
  DeliveryEnum.InPerson,
  DeliveryEnum.Hybrid,
  DeliveryEnum.Offline,
].map((value) => ({
  value,
  label: DELIVERY_LABELS[value],
}))

const GOALS_CHOICES = [
  {
    value: GoalsEnum.AcademicExcellence,
    label: GOALS_LABELS[GoalsEnum.AcademicExcellence],
    description: "Support my degree studies with supplemental learning.",
  },
  {
    value: GoalsEnum.CareerGrowth,
    label: GOALS_LABELS[GoalsEnum.CareerGrowth],
    description: "Advance my career through new skills and certifications.",
  },
  {
    value: GoalsEnum.LifelongLearning,
    label: GOALS_LABELS[GoalsEnum.LifelongLearning],
    description: "Learn about topics that spark my curiosity.",
  },
]

const EDUCATION_LEVEL_OPTIONS: SimpleSelectOption[] = [
  {
    label: <em>Please Select</em>,
    disabled: true,
    value: "",
  },
  ...Object.values(CurrentEducationEnum).map((value) => ({
    value,
    label: CURRENT_EDUCATION_LABELS[value],
  })),
]

const CERTIFICATE_CHOICES = [
  CertificateDesiredEnum.Yes,
  CertificateDesiredEnum.No,
  CertificateDesiredEnum.NotSureYet,
].map((value) => ({
  value,
  label: CERTIFICATE_DESIRED_LABELS[value],
}))

const ProfileSchema = yup.object().shape({
  topic_interests: yup.array().of(yup.string()),
  goals: yup
    .array()
    .of(yup.string().oneOf(GOALS_CHOICES.map((choice) => choice.value))),
  certificate_desired: yup
    .string()
    .oneOf(CERTIFICATE_CHOICES.map((choice) => choice.value)),
  current_education: yup
    .string()
    .oneOf(EDUCATION_LEVEL_OPTIONS.map((choice) => choice.value)),
  delivery: yup
    .array()
    .of(yup.string().oneOf(DELIVERY_CHOICES.map((choice) => choice.value))),
})

export {
  DELIVERY_CHOICES,
  GOALS_CHOICES,
  EDUCATION_LEVEL_OPTIONS,
  CERTIFICATE_CHOICES,
  ProfileSchema,
}
