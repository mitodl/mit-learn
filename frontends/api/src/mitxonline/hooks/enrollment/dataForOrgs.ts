import { CourseRunEnrollment } from "@mitodl/mitxonline-api-axios/v0"
import { mockProgramCourseData } from "../programs/data"

const orgCourseEnollments = {
  upgraded_and_passed: {
    run: {
      title: mockProgramCourseData.foundational.one.title,
      start_date: "2025-02-12T15:00:00Z",
      end_date: "2025-03-10T15:00:00Z",
      enrollment_start: "2025-03-20T15:00:00Z",
      enrollment_end: "2025-03-20T15:00:00Z",
      expiration_date: null,
      courseware_url:
        "https://courses-qa.mitxonline.mit.edu/courses/course-v1:MITxT+14.73x+3T2023/course",
      courseware_id: "course-v1:MITxT+14.73x+3T2023",
      certificate_available_date: "2024-01-03T00:00:00Z",
      upgrade_deadline: "2025-04-10T15:00:00Z",
      is_upgradable: false,
      is_enrollable: false,
      is_archived: false,
      is_self_paced: false,
      run_tag: "3T2023",
      id: 69,
      live: true,
      course_number: "14.73x",
      products: [
        {
          id: 56,
          price: "999.00",
          description: "course-v1:MITxT+14.73x+3T2023",
          is_active: true,
          product_flexible_price: null,
        },
      ],
      approved_flexible_price_exists: false,
      course: {
        id: mockProgramCourseData.foundational.one.id,
        title: mockProgramCourseData.foundational.one.title,
        readable_id: "course-v1:MITxT+14.73x",
        next_run_id: null,
        departments: [
          {
            name: "Economics",
          },
        ],
        page: {
          feature_image_src:
            "/media/original_images/14.73x.jpg?v=74c8454643cd441f918b9bdefce98468902ae6d7",
          page_url:
            "https://rc.mitxonline.mit.edu/courses/course-v1:MITxT+14.73x/",
          description:
            "A course for those who are interested in the challenge posed by massive and persistent world poverty.",
          live: true,
          length: "Estimated 11 weeks",
          effort: "12–14 hours per week",
          financial_assistance_form_url:
            "/programs/program-v1:MITx+DEDP/dedp-micromasters-program-financial-assistance-form/",
          current_price: null,
          instructors: [
            {
              name: "Abhijit Vinayak Banerjee",
              description: "",
            },
            {
              name: "Esther Duflo",
              description: "",
            },
          ],
        },
        programs: null,
        // @ts-expect-error Schema says this doesn't exist; we won't use it.
        feature_image_src:
          "/media/original_images/14.73x.jpg?v=74c8454643cd441f918b9bdefce98468902ae6d7",
        page_url:
          "https://rc.mitxonline.mit.edu/courses/course-v1:MITxT+14.73x/",
        description:
          "A course for those who are interested in the challenge posed by massive and persistent world poverty.",
        live: true,
        length: "Estimated 11 weeks",
        effort: "12–14 hours per week",
        financial_assistance_form_url:
          "/programs/program-v1:MITx+DEDP/dedp-micromasters-program-financial-assistance-form/",
        current_price: null,
        instructors: [
          {
            name: "Abhijit Vinayak Banerjee",
            description: "",
          },
          {
            name: "Esther Duflo",
            description: "",
          },
        ],
      },
    },
    id: 64368345,
    edx_emails_subscription: true,
    certificate: null,
    enrollment_mode: "audit",
    approved_flexible_price_exists: false,
    grades: [
      {
        grade: 0.7,
        letter_grade: null,
        passed: true,
        set_by_admin: false,
        grade_percent: 0,
      },
    ],
  },
  upgraded_and_not_finished: {
    run: {
      title: mockProgramCourseData.foundational.two.title,
      start_date: "2025-02-12T15:00:00Z",
      end_date: "2040-12-20T15:00:00Z",
      enrollment_start: "2024-03-07T23:59:00Z",
      enrollment_end: "2035-10-25T23:59:00Z",
      expiration_date: null,
      courseware_url:
        "https://courses-qa.mitxonline.mit.edu/courses/course-v1:MITxT+14.73x+3T2023/course",
      courseware_id: "course-v1:MITxT+14.73x+3T2023",
      certificate_available_date: "2024-01-03T00:00:00Z",
      upgrade_deadline: "2025-04-10T15:00:00Z",
      is_upgradable: true,
      is_enrollable: false,
      is_archived: false,
      is_self_paced: false,
      run_tag: "3T2023",
      id: 69,
      live: true,
      course_number: "14.73x",
      products: [
        {
          id: 56,
          price: "999.00",
          description: "course-v1:MITxT+14.73x+3T2023",
          is_active: true,
          product_flexible_price: null,
        },
      ],
      approved_flexible_price_exists: false,
      course: {
        id: mockProgramCourseData.foundational.two.id,
        title: mockProgramCourseData.foundational.two.title,
        readable_id: "course-v1:MITxT+14.73x",
        next_run_id: null,
        departments: [
          {
            name: "Economics",
          },
        ],
        page: {
          feature_image_src:
            "/media/original_images/14.73x.jpg?v=74c8454643cd441f918b9bdefce98468902ae6d7",
          page_url:
            "https://rc.mitxonline.mit.edu/courses/course-v1:MITxT+14.73x/",
          description:
            "A course for those who are interested in the challenge posed by massive and persistent world poverty.",
          live: true,
          length: "Estimated 11 weeks",
          effort: "12–14 hours per week",
          financial_assistance_form_url:
            "/programs/program-v1:MITx+DEDP/dedp-micromasters-program-financial-assistance-form/",
          current_price: null,
          instructors: [
            {
              name: "Abhijit Vinayak Banerjee",
              description: "",
            },
            {
              name: "Esther Duflo",
              description: "",
            },
          ],
        },
        programs: null,
        // @ts-expect-error Schema says this doesn't exist; we won't use it.
        feature_image_src:
          "/media/original_images/14.73x.jpg?v=74c8454643cd441f918b9bdefce98468902ae6d7",
        page_url:
          "https://rc.mitxonline.mit.edu/courses/course-v1:MITxT+14.73x/",
        description:
          "A course for those who are interested in the challenge posed by massive and persistent world poverty.",
        live: true,
        length: "Estimated 11 weeks",
        effort: "12–14 hours per week",
        financial_assistance_form_url:
          "/programs/program-v1:MITx+DEDP/dedp-micromasters-program-financial-assistance-form/",
        current_price: null,
        instructors: [
          {
            name: "Abhijit Vinayak Banerjee",
            description: "",
          },
          {
            name: "Esther Duflo",
            description: "",
          },
        ],
      },
    },
    id: 6436834,
    edx_emails_subscription: true,
    certificate: null,
    enrollment_mode: "audit",
    approved_flexible_price_exists: false,
    grades: [
      {
        grade: 0,
        letter_grade: null,
        passed: false,
        set_by_admin: false,
        grade_percent: 0,
      },
    ],
  },
  upgraded_and_not_passed: {
    run: {
      title: mockProgramCourseData.foundational.three.title,
      start_date: "2025-02-12T15:00:00Z",
      end_date: "2025-03-10T15:00:00Z",
      enrollment_start: "2025-03-20T15:00:00Z",
      enrollment_end: "2025-03-20T15:00:00Z",
      expiration_date: null,
      courseware_url:
        "https://courses-qa.mitxonline.mit.edu/courses/course-v1:MITxT+14.73x+3T2023/course",
      courseware_id: "course-v1:MITxT+14.73x+3T2023",
      certificate_available_date: "2024-01-03T00:00:00Z",
      upgrade_deadline: "2025-04-10T15:00:00Z",
      is_upgradable: false,
      is_enrollable: false,
      is_archived: false,
      is_self_paced: false,
      run_tag: "3T2023",
      id: 69,
      live: true,
      course_number: "14.73x",
      products: [
        {
          id: 56,
          price: "999.00",
          description: "course-v1:MITxT+14.73x+3T2023",
          is_active: true,
          product_flexible_price: null,
        },
      ],
      approved_flexible_price_exists: false,
      course: {
        id: mockProgramCourseData.foundational.two.id,
        title: mockProgramCourseData.foundational.two.title,
        readable_id: "course-v1:MITxT+14.73x",
        next_run_id: null,
        departments: [
          {
            name: "Economics",
          },
        ],
        page: {
          feature_image_src:
            "/media/original_images/14.73x.jpg?v=74c8454643cd441f918b9bdefce98468902ae6d7",
          page_url:
            "https://rc.mitxonline.mit.edu/courses/course-v1:MITxT+14.73x/",
          description:
            "A course for those who are interested in the challenge posed by massive and persistent world poverty.",
          live: true,
          length: "Estimated 11 weeks",
          effort: "12–14 hours per week",
          financial_assistance_form_url:
            "/programs/program-v1:MITx+DEDP/dedp-micromasters-program-financial-assistance-form/",
          current_price: null,
          instructors: [
            {
              name: "Abhijit Vinayak Banerjee",
              description: "",
            },
            {
              name: "Esther Duflo",
              description: "",
            },
          ],
        },
        programs: null,
        // @ts-expect-error Schema says this doesn't exist; we won't use it.
        feature_image_src:
          "/media/original_images/14.73x.jpg?v=74c8454643cd441f918b9bdefce98468902ae6d7",
        page_url:
          "https://rc.mitxonline.mit.edu/courses/course-v1:MITxT+14.73x/",
        description:
          "A course for those who are interested in the challenge posed by massive and persistent world poverty.",
        live: true,
        length: "Estimated 11 weeks",
        effort: "12–14 hours per week",
        financial_assistance_form_url:
          "/programs/program-v1:MITx+DEDP/dedp-micromasters-program-financial-assistance-form/",
        current_price: null,
        instructors: [
          {
            name: "Abhijit Vinayak Banerjee",
            description: "",
          },
          {
            name: "Esther Duflo",
            description: "",
          },
        ],
      },
    },
    id: 643683452,
    edx_emails_subscription: true,
    certificate: null,
    enrollment_mode: "audit",
    approved_flexible_price_exists: false,
    grades: [
      {
        grade: 0.2,
        letter_grade: null,
        passed: false,
        set_by_admin: false,
        grade_percent: 0,
      },
    ],
  },
} satisfies Record<string, CourseRunEnrollment>

const orgData = {
  orgX: { id: 488, name: "Organization X" },
  orgY: {
    id: 522,
    name: "Organization Y",
    logo: "https://brand.mit.edu/sites/default/files/styles/tile_narrow/public/2023-08/logo-colors-mit-red.png?itok=k08Ir4pB",
  },
}

const orgXEnrollments = Object.values(orgCourseEnollments)
const orgYEnrollments = Object.values(orgCourseEnollments).slice(0, 2)

export { orgXEnrollments, orgYEnrollments, orgData }
