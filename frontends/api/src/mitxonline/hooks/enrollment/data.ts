// FAKE DATA while API / auth work is in development
import { CourseRunEnrollment } from "../../generated/v0"

const soon = (days: number) => {
  return new Date(new Date().setDate(new Date().getDate() + days)).toISOString()
}

const courses = {
  started_not_upgradeable: {
    run: {
      title: "Enrolled, Started, Not Upgradeable",
      start_date: "2003-01-01T00:00:00Z",
      end_date: null,
      enrollment_start: "2003-01-01T00:00:00Z",
      enrollment_end: "2030-01-01T00:00:00Z",
      expiration_date: null,
      courseware_url:
        "https://courses-qa.mitxonline.mit.edu/courses/course-v1:xOnline+test+3T2022/course/",
      courseware_id: "course-v1:xOnline+test+3T2022",
      certificate_available_date: null,
      upgrade_deadline: "2022-12-01T16:35:06Z",
      is_upgradable: false,
      is_enrollable: true,
      is_archived: false,
      is_self_paced: false,
      run_tag: "3T2022",
      id: 20,
      live: true,
      course_number: "test",
      products: [
        {
          id: 12,
          price: "999.00",
          description: "course-v1:xOnline+test",
          is_active: true,
          product_flexible_price: null,
        },
      ],
      approved_flexible_price_exists: false,
      course: {
        id: 21,
        title: "Enrolled, Started, Not Upgradeable",
        readable_id: "course-v1:xOnline+test",
        next_run_id: 20,
        departments: [
          {
            name: "Department 1",
          },
          {
            name: "Department 2",
          },
          {
            name: "Department 3",
          },
          {
            name: "Department 4",
          },
        ],
        page: {
          feature_image_src:
            "/media/original_images/kitten_550x500_1.jpeg?v=5971b4abbe19609fd96201988b7ab2c04d800d74",
          page_url:
            "https://rc.mitxonline.mit.edu/courses/course-v1:xOnline+test/",
          description:
            "This is a test that is made for just testing purposes. You can use it for all of your testing-related stuff and enjoy it after wards. Hope you enjoy it though. 1000 characters is an underestimate of the size limit. Importantly, we don&#x27;t want line breaks in this description.",
          live: true,
          length: "1 year",
          effort: "Minimal",
          financial_assistance_form_url:
            "/courses/course-v1:xOnline+test/test-program-flex-price-form/",
          current_price: 999,
          instructors: [
            {
              name: "Instructor 1",
              description: "",
            },
            {
              name: "Instructor 2",
              description: "",
            },
            {
              name: "Instructor 3",
              description: "",
            },
            {
              name: "Instructor 4",
              description: "",
            },
            {
              name: "Instructor 5",
              description: "",
            },
          ],
        },
        programs: null,
        // @ts-expect-error Schema says this doesn't exist; we won't use it.
        feature_image_src:
          "/media/original_images/kitten_550x500_1.jpeg?v=5971b4abbe19609fd96201988b7ab2c04d800d74",
        page_url:
          "https://rc.mitxonline.mit.edu/courses/course-v1:xOnline+test/",
        description:
          "This is a test that is made for just testing purposes. You can use it for all of your testing-related stuff and enjoy it after wards. Hope you enjoy it though. 1000 characters is an underestimate of the size limit. Importantly, we don&#x27;t want line breaks in this description.",
        live: true,
        length: "1 year",
        effort: "Minimal",
        financial_assistance_form_url:
          "/courses/course-v1:xOnline+test/test-program-flex-price-form/",
        current_price: 999,
        instructors: [
          {
            name: "Instructor 1",
            description: "",
          },
          {
            name: "Instructor 2",
            description: "",
          },
          {
            name: "Instructor 3",
            description: "",
          },
          {
            name: "Instructor 4",
            description: "",
          },
          {
            name: "Instructor 5",
            description: "",
          },
        ],
      },
    },
    id: 1118,
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
  ended: {
    run: {
      title: "Course That Has Ended",
      start_date: "2003-01-01T00:00:00Z",
      end_date: "2025-01-01T00:00:00Z",
      enrollment_start: "2003-01-01T00:00:00Z",
      enrollment_end: "2025-01-01T00:00:00Z",
      expiration_date: null,
      courseware_url:
        "https://courses-qa.mitxonline.mit.edu/courses/course-v1:xOnline+test+3T2022/course/",
      courseware_id: "course-v1:xOnline+test+3T2022",
      certificate_available_date: null,
      upgrade_deadline: "2022-12-01T16:35:06Z",
      is_upgradable: false,
      is_enrollable: true,
      is_archived: false,
      is_self_paced: false,
      run_tag: "3T2022",
      id: 20,
      live: true,
      course_number: "test",
      products: [
        {
          id: 12,
          price: "999.00",
          description: "course-v1:xOnline+test",
          is_active: true,
          product_flexible_price: null,
        },
      ],
      approved_flexible_price_exists: false,
      course: {
        id: 22,
        title: "Course That Has Ended",
        readable_id: "course-v1:xOnline+test",
        next_run_id: 20,
        departments: [
          {
            name: "Department 1",
          },
          {
            name: "Department 2",
          },
          {
            name: "Department 3",
          },
          {
            name: "Department 4",
          },
        ],
        page: {
          feature_image_src:
            "/media/original_images/kitten_550x500_1.jpeg?v=5971b4abbe19609fd96201988b7ab2c04d800d74",
          page_url:
            "https://rc.mitxonline.mit.edu/courses/course-v1:xOnline+test/",
          description:
            "This is a test that is made for just testing purposes. You can use it for all of your testing-related stuff and enjoy it after wards. Hope you enjoy it though. 1000 characters is an underestimate of the size limit. Importantly, we don&#x27;t want line breaks in this description.",
          live: true,
          length: "1 year",
          effort: "Minimal",
          financial_assistance_form_url:
            "/courses/course-v1:xOnline+test/test-program-flex-price-form/",
          current_price: 999,
          instructors: [
            {
              name: "Instructor 1",
              description: "",
            },
            {
              name: "Instructor 2",
              description: "",
            },
            {
              name: "Instructor 3",
              description: "",
            },
            {
              name: "Instructor 4",
              description: "",
            },
            {
              name: "Instructor 5",
              description: "",
            },
          ],
        },
        programs: null,
        // @ts-expect-error Schema says this doesn't exist; we won't use it.
        feature_image_src:
          "/media/original_images/kitten_550x500_1.jpeg?v=5971b4abbe19609fd96201988b7ab2c04d800d74",
        page_url:
          "https://rc.mitxonline.mit.edu/courses/course-v1:xOnline+test/",
        description:
          "This is a test that is made for just testing purposes. You can use it for all of your testing-related stuff and enjoy it after wards. Hope you enjoy it though. 1000 characters is an underestimate of the size limit. Importantly, we don&#x27;t want line breaks in this description.",
        live: true,
        length: "1 year",
        effort: "Minimal",
        financial_assistance_form_url:
          "/courses/course-v1:xOnline+test/test-program-flex-price-form/",
        current_price: 999,
        instructors: [
          {
            name: "Instructor 1",
            description: "",
          },
          {
            name: "Instructor 2",
            description: "",
          },
          {
            name: "Instructor 3",
            description: "",
          },
          {
            name: "Instructor 4",
            description: "",
          },
          {
            name: "Instructor 5",
            description: "",
          },
        ],
      },
    },
    id: 4211118,
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
  started_already_upgraded: {
    run: {
      title:
        "Started and Already Upgraded And This Course Has a Really Long Name That Goes Across Multiple Lines",
      start_date: "2022-09-06T15:00:00Z",
      end_date: "2028-12-14T15:00:00Z",
      enrollment_start: "2022-07-06T23:59:00Z",
      enrollment_end: "2022-10-11T23:59:00Z",
      expiration_date: null,
      courseware_url:
        "https://courses-qa.mitxonline.mit.edu/courses/course-v1:MITxT+14.310x+3T2022/course/",
      courseware_id: "course-v1:MITxT+14.310x+3T2022",
      certificate_available_date: "2022-12-16T15:00:00Z",
      upgrade_deadline: "2025-12-04T15:00:00Z",
      is_upgradable: true,
      is_enrollable: false,
      is_archived: false,
      is_self_paced: false,
      run_tag: "3T2022",
      id: 22,
      live: true,
      course_number: "14.310x",
      products: [
        {
          id: 16,
          price: "999.00",
          description: "course-v1:MITxT+14.310x+3T2022",
          is_active: true,
          product_flexible_price: null,
        },
      ],
      approved_flexible_price_exists: false,
      course: {
        id: 31,
        title:
          "Started and Already Upgraded And This Course Has a Really Long Name That Goes Across Multiple Lines",

        readable_id: "course-v1:MITx+14.310x",
        next_run_id: null,
        departments: [
          {
            name: "Economics",
          },
        ],
        page: {
          feature_image_src:
            "/media/original_images/14.310x.jpg?v=6f09dcf8fe955707a565e18b9864c83a1bbe2563",
          page_url:
            "https://rc.mitxonline.mit.edu/courses/course-v1:MITx+14.310x/",
          description:
            "Learn methods for harnessing and analyzing data to answer questions of cultural, social, economic, and policy interest.",
          live: false,
          length: "Estimated 11 Weeks",
          effort: "12–14 hours per week",
          financial_assistance_form_url:
            "/courses/course-v1:MITx+14.310x/data-analysis-for-social-scientists-request-flexible-pricing/",
          current_price: null,
          instructors: [
            {
              name: "Esther Duflo",
              description: "",
            },
            {
              name: "Sara Fisher Ellison",
              description: "",
            },
          ],
        },
        programs: null,
        // @ts-expect-error Schema says this doesn't exist; we won't use it.
        feature_image_src:
          "/media/original_images/14.310x.jpg?v=6f09dcf8fe955707a565e18b9864c83a1bbe2563",
        page_url:
          "https://rc.mitxonline.mit.edu/courses/course-v1:MITx+14.310x/",
        description:
          "Learn methods for harnessing and analyzing data to answer questions of cultural, social, economic, and policy interest.",
        live: false,
        length: "Estimated 11 Weeks",
        effort: "12–14 hours per week",
        financial_assistance_form_url:
          "/courses/course-v1:MITx+14.310x/data-analysis-for-social-scientists-request-flexible-pricing/",
        current_price: null,
        instructors: [
          {
            name: "Esther Duflo",
            description: "",
          },
          {
            name: "Sara Fisher Ellison",
            description: "",
          },
        ],
      },
    },
    id: 551,
    edx_emails_subscription: true,
    certificate: null,
    enrollment_mode: "verified",
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
  upgradeable_course_not_started: {
    run: {
      title: "Upgradeable Course, Not Yet Started",
      start_date: soon(1),
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
      id: 691,
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
        id: 34,
        title: "Upgradeable Course, Not Yet Started",
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
    id: 8342,
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
  upgradeable_course_not_started_long_name: {
    run: {
      title:
        "Upgradeable Course, Not Yet Started, And This Course Also Has A Really Long Name That Goes Across Multiple Lines",
      start_date: soon(5),
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
        id: 35,
        title:
          "Upgradeable Course, Not Yet Started, And This Course Also Has A Really Long Name That Goes Across Multiple Lines",
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
    id: 834,
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
  not_upgradeable_not_started: {
    run: {
      title: "Not Upgradeable, Not Started",
      start_date: soon(10),
      end_date: "2040-12-20T15:00:00Z",
      enrollment_start: "2024-03-07T23:59:00Z",
      enrollment_end: "2035-10-25T23:59:00Z",
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
      products: [],
      approved_flexible_price_exists: false,
      course: {
        id: 36,
        title: "Not Upgradeable, Not Started",
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
    id: 8341,
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
  upgradable_course_has_started: {
    run: {
      title: "Upgradeable Course, Already Started",
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
        id: 37,
        title: "Upgradeable Course, Already Started",
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
  upgraded_and_passed: {
    run: {
      title: "Upgradeable Course, Ended and Passed",
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
        id: 38,
        title: "Upgradeable Course, Ended and Passed",
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
  upgraded_and_not_passed: {
    run: {
      title: "Upgradeable Course, Ended and Not Passed",
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
        id: 39,
        title: "Upgradeable Course, Ended and Not Passed",
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
        grade: 0.3,
        letter_grade: null,
        passed: false,
        set_by_admin: false,
        grade_percent: 0,
      },
    ],
  },
} satisfies Record<string, CourseRunEnrollment>

const enrollments: CourseRunEnrollment[] = Object.values(courses)

export { enrollments }
