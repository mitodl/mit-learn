// FAKE DATA while API / auth work is in development
import { PaginatedV2ProgramList } from "../../generated/v0"

const mockProgramCourseData = {
  foundational: {
    one: {
      id: 1001,
      title:
        "Introduction to Data Analytics, Machine Learning, & Python Coding",
    },
    two: { id: 1002, title: "Prescriptive Analytics" },
    three: { id: 1003, title: "Supervised Learning Fundamentals" },
    four: { id: 1004, title: "Clustering and Unsupervised Learning" },
    five: {
      id: 1005,
      title: "Deep Learning and Convolutional Neural Networks",
    },
    six: { id: 1006, title: "Natural Language Processing" },
    seven: { id: 1007, title: "Large Language Models" },
    eight: {
      id: 1008,
      title: "Generative AI, the Future of Work, and Human Creativity",
    },
    nine: { id: 1009, title: "Multimodal AI" },
  },
  industry: {
    one: { id: 2001, title: "AI and Machine Learning for Transportation" },
    two: { id: 2002, title: "AI and Precision Medicine" },
    three: { id: 2003, title: "AI for Human Experience" },
    four: { id: 2004, title: "AI and Commerce" },
  },
}

const universalAiProgramData: PaginatedV2ProgramList = {
  count: 1,
  next: null,
  previous: null,
  results: [
    {
      title: "Foundational AI Modules",
      readable_id: "program-v1:MITxT+UAI.01x",
      id: 101,
      courses: [
        mockProgramCourseData.foundational.one.id,
        mockProgramCourseData.foundational.two.id,
        mockProgramCourseData.foundational.three.id,
        mockProgramCourseData.foundational.four.id,
        mockProgramCourseData.foundational.five.id,
        mockProgramCourseData.foundational.six.id,
        mockProgramCourseData.foundational.seven.id,
        mockProgramCourseData.foundational.eight.id,
        mockProgramCourseData.foundational.nine.id,
      ],
      requirements: {
        required: [],
        electives: [],
      },
      req_tree: [],
      page: {
        feature_image_src: "/static/images/mit-dome.png",
        page_url: "/programs/program-v1:MITxT+18.03x/",
        financial_assistance_form_url: "",
        description: "MITxOnline returns raw HTML here.",
        live: false,
        length: "14 weeks",
        effort: "7 hrs/wk",
        price: "$175",
      },
      program_type: "Series",
      certificate_type: "Certificate of Completion",
      departments: [
        {
          name: "Mathematics",
        },
      ],
      live: false,
      topics: [
        {
          name: "Mathematics",
        },
        {
          name: "Science & Math",
        },
      ],
      availability: "anytime",
      start_date: null,
      end_date: null,
      enrollment_start: null,
      enrollment_end: null,
      required_prerequisites: true,
      duration: "14 weeks",
      min_weeks: 14,
      max_weeks: 14,
      time_commitment: "7 hrs/wk",
      min_weekly_hours: "7",
      max_weekly_hours: "7",
    },
    {
      title: "Industry-specific Vertical Modules",
      readable_id: "program-v1:MITxT+UAI.02x",
      id: 201,
      courses: [
        mockProgramCourseData.industry.one.id,
        mockProgramCourseData.industry.two.id,
        mockProgramCourseData.industry.three.id,
        mockProgramCourseData.industry.four.id,
      ],
      requirements: {
        required: [],
        electives: [],
      },
      req_tree: [],
      page: {
        feature_image_src: "/static/images/mit-dome.png",
        page_url: "/programs/program-v1:MITxT+18.03x/",
        financial_assistance_form_url: "",
        description: "MITxOnline returns raw HTML here.",
        live: false,
        length: "14 weeks",
        effort: "7 hrs/wk",
        price: "$175",
      },
      program_type: "Series",
      certificate_type: "Certificate of Completion",
      departments: [
        {
          name: "Mathematics",
        },
      ],
      live: false,
      topics: [
        {
          name: "Mathematics",
        },
        {
          name: "Science & Math",
        },
      ],
      availability: "anytime",
      start_date: null,
      end_date: null,
      enrollment_start: null,
      enrollment_end: null,
      required_prerequisites: true,
      duration: "14 weeks",
      min_weeks: 14,
      max_weeks: 14,
      time_commitment: "7 hrs/wk",
      min_weekly_hours: "7",
      max_weekly_hours: "7",
    },
  ],
}

export { universalAiProgramData, mockProgramCourseData }
