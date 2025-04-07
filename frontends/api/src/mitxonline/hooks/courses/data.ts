// FAKE DATA while API / auth work is in development
import { CourseWithCourseRuns } from "../../generated/v0"
import { mockProgramCourseData } from "../programs/data"

const fakeCourse = ({
  id,
  title,
}: {
  id: number
  title: string
}): CourseWithCourseRuns => {
  const runId = id * 10
  return {
    id,
    title,
    readable_id: "course-v1:MITxT+18.03.2x",
    next_run_id: runId,
    departments: [{ name: "Mathematics" }],
    page: {
      feature_image_src:
        "/media/original_images/18.032x_courseimage_MITxO.png?v=bb0e1eaeb2bc4ff5f079d479ece6954bd8f22ca6",
      page_url: "/courses/course-v1:MITxT+18.03.2x/",
      description:
        "In order to understand most phenomena in the world, we need to understand not just single equations, but systems of differential equations. In this course, we start with 2x2 systems.",
      live: true,
      length: "9 weeks",
      effort: "5-8 hrs/wk",
      financial_assistance_form_url: "",
      current_price: 75.0,
      instructors: [{ name: "Jennifer French", description: "" }],
    },
    programs: null,
    topics: [{ name: "Mathematics" }, { name: "Science & Math" }],
    certificate_type: "Certificate of Completion",
    required_prerequisites: true,
    duration: "9 weeks",
    min_weeks: 9,
    max_weeks: 9,
    time_commitment: "5-8 hrs/wk",
    availability: "anytime",
    min_weekly_hours: "5",
    max_weekly_hours: "8",
    courseruns: [
      {
        title: "Differential Equations: 2x2 Systems",
        start_date: "2025-01-08T16:00:00Z",
        end_date: "2025-03-19T16:00:00Z",
        enrollment_start: "2024-12-13T16:00:00Z",
        enrollment_end: null,
        expiration_date: null,
        courseware_url:
          "https://courses.mitxonline.mit.edu/courses/course-v1:MITxT+18.03.2x+1T2025/course",
        courseware_id: "course-v1:MITxT+18.03.2x+1T2025",
        certificate_available_date: "2025-03-19T16:00:00Z",
        upgrade_deadline: "2025-03-09T16:00:00Z",
        is_upgradable: false,
        is_enrollable: true,
        is_archived: false,
        is_self_paced: false,
        run_tag: "1T2025",
        id: runId,
        live: true,
        course_number: "18.03.2x",
        products: [],
        approved_flexible_price_exists: false,
      },
    ],
  }
}

const universalAiCourses: CourseWithCourseRuns[] = [
  fakeCourse(mockProgramCourseData.foundational.one),
  fakeCourse(mockProgramCourseData.foundational.two),
  fakeCourse(mockProgramCourseData.foundational.three),
  fakeCourse(mockProgramCourseData.foundational.four),
  fakeCourse(mockProgramCourseData.foundational.five),
  fakeCourse(mockProgramCourseData.foundational.six),
  fakeCourse(mockProgramCourseData.foundational.seven),
  fakeCourse(mockProgramCourseData.foundational.eight),
  fakeCourse(mockProgramCourseData.foundational.nine),
  fakeCourse(mockProgramCourseData.industry.one),
  fakeCourse(mockProgramCourseData.industry.two),
  fakeCourse(mockProgramCourseData.industry.three),
  fakeCourse(mockProgramCourseData.industry.four),
]

export { universalAiCourses }
