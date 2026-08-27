/**
 * Static copy for the /organizational-learning landing page.
 *
 * This page has no CMS by design — marketing revises copy through PRs. Keeping
 * every string here means a copy pass is a diff against one file with no JSX in
 * it, rather than an edit spread across eight section components.
 */

export type StatItem = { value: string; label: string[] }
export type IconBoxItem = { title: string; body: string }
export type OfferingCardItem = {
  title: string
  tagline: string
  body: string
  bestForLabel: string
  bestFor: string[]
}
export type ContinuumStepItem = {
  eyebrow: string
  title: string
  body: string
}
export type FaqItem = { question: string; answer: string }

export const hero = {
  title: "Empower people across your organization",
  body: "We offer a portfolio of educational programs for businesses, government, and higher education institutions. We'll help you explore MIT learning opportunities that best align with your organization's goals.",
  ctaLabel: "Get in Touch",
  image: "/images/uai_landing/uai-landing-hero-2.jpg",
  imageAlt: "",
  stats: [
    { value: "700+", label: ["Organizational", "partnerships"] },
    { value: "150+", label: ["MIT faculty", "& experts involved"] },
    { value: "CEUs", label: ["Certificates", "& continuing ed. units"] },
  ] satisfies StatItem[],
}

export const featuredProgram = {
  eyebrow: "FEATURED PROGRAM",
  title: "Universal AI",
  tagline: "Build AI fluency across your organization.",
  body: "A flexible, self-paced curriculum from MIT faculty and experts, combining foundational AI learning with industry-specific applications.",
  highlights: [
    "Self-paced",
    "MIT faculty & experts",
    "Stackable",
    "AI tutor support",
    "Translation available",
  ],
  curriculum: {
    eyebrow: "INSIDE UNIVERSAL AI",
    title: "20+ modules to build and apply AI skills",
    groups: [
      {
        title: "FOUNDATIONAL",
        modules: [
          "Hands-On Deep Learning",
          "Large Language Models",
          "AI, Ethics & Reasoning",
        ],
      },
      {
        title: "INDUSTRY APPLICATIONS",
        modules: [
          "AI + Healthcare",
          "AI + Sustainability: Energy",
          "AI + Finance",
        ],
      },
    ],
    footnote: "6 MODULES FROM THE FULL COLLECTION",
  },
  ctaLabel: "Talk with our team",
}

export const offerings = {
  eyebrow: "FOR YOUR ORGANIZATION",
  title: "Learning solutions for every stage of your organization",
  body: "Flexible learning options designed to meet your goals — whether you're building leadership skills, adopting AI, or strengthening technical capabilities.",
  cards: [
    {
      title: "Executive & Leadership",
      tagline:
        "Build confident leaders who drive change and inspire high-performing teams",
      body: "Live sessions with global thought leaders, plus real-world frameworks.",
      bestForLabel: "Best for:",
      bestFor: ["Executives", "Leaders", "Directors", "Managers"],
    },
    {
      title: "AI Training",
      tagline: "Equip your teams to work smarter and innovate with AI.",
      body: "Practical skills to apply AI tools and techniques in your organization.",
      bestForLabel: "Best for:",
      bestFor: ["All roles", "Specialists", "Analysts", "Teams"],
    },
    {
      title: "Technical & Professional Skills",
      tagline:
        "Strengthen technical skills and solve real business challenges.",
      body: "In-depth learning in topics critical to your projects and goals.",
      bestForLabel: "Best for:",
      bestFor: ["Engineers", "Developers", "Analysts", "Teams"],
    },
  ] satisfies OfferingCardItem[],
  flexibleSolutions: {
    title: "Flexible Solutions",
    body: "From short executive briefings to in-depth learning programs, we offer flexible formats designed to fit your organization's needs, priorities, and scale.",
    pills: [
      "Audience",
      "Technical depth",
      "Course duration",
      "Delivery format",
      "Goals",
      "Group size",
    ],
  },
  ctaLabel: "Talk with our team",
}

export const deliveryFormats = {
  eyebrow: "FLEXIBLE LEARNING FORMATS",
  title: "Build the right solution from flexible learning formats",
  body: "Select the formats that fit your people and goals — scalable, flexible and designed for real-world impact.",
  items: [
    {
      title: "Programs",
      body: "In-depth learning experiences to build foundational or advanced capabilities at scale.",
    },
    {
      title: "Courses",
      body: "Self-paced or instructor-led learning on key topics and skills.",
    },
    {
      title: "Workshops",
      body: "Interactive, live sessions to accelerate team alignment and apply learning in the moment.",
    },
    {
      title: "Seminars & expert briefings",
      body: "Concise sessions with MIT subject matter experts on emerging trends.",
    },
    {
      title: "Webinars",
      body: "Live or on-demand sessions to explore timely topics and share insights with your team.",
    },
    {
      title: "Learning resources",
      body: "Articles, videos, case studies, and tools to reinforce learning and drive action.",
    },
  ] satisfies IconBoxItem[],
  ctaLabel: "Talk with our team",
}

export const continuum = {
  eyebrow: "MIT'S LEARNING APPROACH",
  title: "One continuum, from first exposure to organizational leadership",
  body: "MIT brings the continuum in organizational education — so you can grow skills, apply them to your work, and lead at the highest level.",
  steps: [
    {
      eyebrow: "01 . FOUNDATIONAL LITERACY",
      title: "Build awareness",
      body: "Introduce your team to new ideas and future-focused thinking.",
    },
    {
      eyebrow: "02 . TECHNICAL SKILL BUILDING",
      title: "Grow capabilities",
      body: "Deepen skills through structured learning and practical application.",
    },
    {
      eyebrow: "03 . LEADERSHIP FLUENCY",
      title: "Drive transformation",
      body: "Embed learning into strategy and culture to achieve lasting impact.",
    },
  ] satisfies ContinuumStepItem[],
}

const FAQ_ANSWER_PENDING = "Answer pending from the content handoff."

export const faq = {
  eyebrow: "LET'S TALK SOLUTIONS",
  title: "Answers before you talk to our team.",
  items: [
    {
      question: "Do we need to know exactly what type of solution we need?",
      answer: FAQ_ANSWER_PENDING,
    },
    {
      question: "How are the lectures by MIT faculty structured?",
      answer: FAQ_ANSWER_PENDING,
    },
    {
      question: "How do guided exercises support learning?",
      answer: FAQ_ANSWER_PENDING,
    },
    {
      question:
        "What is the AI-powered AskTIM feature and how does it support learners?",
      answer: FAQ_ANSWER_PENDING,
    },
    {
      question: "How is learning assessed throughout the modules?",
      answer: FAQ_ANSWER_PENDING,
    },
    {
      question:
        "What kind of support is available for administrators and instructors?",
      answer: FAQ_ANSWER_PENDING,
    },
  ] satisfies FaqItem[],
}

export const getInTouch = {
  eyebrow: "GET IN TOUCH",
  title: "Let's build your organization's learning solution.",
  pitch:
    "You don't need a program or solution mapped out before reaching out. Our team can help you explore challenges, identify the right approach, and guide you every step of the way.",
  assurances: [
    "No pressure — just a conversation about your goals.",
    "We'll help you identify the right first step, for now or later.",
    "We take data and privacy seriously.",
  ],
  submitLabel: "Talk with our team",
  audience: {
    label: "Who are you exploring learning for?",
    hint: "This helps us connect you with the right team.",
    organizationLabel: "My organization",
    organizationDescription:
      "Businesses, government, universities, and other institutions",
    individualLabel: "Myself",
    individualDescription: "I want to learn on my own",
  },

  individual: {
    title: "Looking to learn on your own?",
    body: "MIT Learn is free to browse. Explore courses and programs from across MIT and enroll directly — no sales conversation needed.",
    primaryCtaLabel: "Browse courses",
    secondaryCtaLabel: "Browse programs",
  },
  success: {
    title: "Thanks — we'll be in touch.",
    body: "Our team will review what you shared and follow up by email. In the meantime, feel free to keep exploring MIT Learn.",
  },
  /** Rendered when no HubSpot form id is configured for the environment. */
  unavailable:
    "The contact form is unavailable right now. Please try again later.",
}
