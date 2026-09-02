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
export type ClientLogoItem = {
  name: string
  src: string
  width: number
  height: number
}

export const hero = {
  title:
    "Transform your organization with MIT Open Learning’s technical expertise",
  body: "We work with businesses, schools, and government agencies to educate diverse workforces on the most impactful technologies of the moment. Connect with our team to learn how our portfolio of MIT Open Learning courses and programs can be matched to your organization’s training goals.",
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
  eyebrow: "PROGRAM SPOTLIGHT",
  title: "Universal AI",
  tagline: "Build AI fluency across your organization.",
  body: "A flexible, self-paced curriculum from MIT faculty and experts, combining foundational AI learning with industry-specific applications.",
  highlights: [
    "Self-paced program",
    "MIT faculty & experts",
    "Stackable modules",
    "AI tutor support",
    "Translation available",
  ],
  curriculum: {
    eyebrow: "INSIDE UNIVERSAL AI",
    title: "20+ modules to build and apply AI skills",
    groups: [
      {
        title: "EXAMPLE FOUNDATIONAL MODULES",
        modules: [
          "Hands-On Deep Learning",
          "Large Language Models",
          "AI, Ethics & Reasoning",
        ],
      },
      {
        title: "EXAMPLE INDUSTRY APPLICATION MODULES",
        modules: [
          "AI + Healthcare",
          "AI + Sustainability and Energy",
          "AI + Finance",
        ],
      },
    ],
  },
  ctaLabel: "Talk with our team",
}

export const offerings = {
  eyebrow: "FOR YOUR ORGANIZATION",
  title: "Learning Solutions for Every Role and Responsibility",
  body: "Flexible learning options designed around your goals, whether you're building leadership skills, adopting AI, or strengthening technical capabilities.",
  cards: [
    {
      title: "Programs for Aspiring AI Specialists",
      tagline: "Equip your teams to work smarter and innovate with AI",
      body: "Practical skills to apply AI tools and techniques in your organization",
      bestForLabel: "Best for:",
      bestFor: ["All roles", "Specialists", "Analysts", "Teams"],
    },
    {
      title: "Programs for Other Technologists",
      tagline: "Strengthen technical skills and solve real business challenges",
      body: "In-depth learning in topics critical to your projects and goals",
      bestForLabel: "Best for:",
      bestFor: ["Engineers", "Developers", "Analysts", "Teams"],
    },
    {
      title: "Programs for Leaders",
      tagline:
        "Build leaders who drive transformation through technical understanding and proven leadership frameworks",
      body: "Asynchronous programs or synchronous sessions meant to develop technical understanding and inform organizational strategy",
      bestForLabel: "Best for:",
      bestFor: ["Executives", "Leaders", "Directors", "Managers"],
    },
  ] satisfies OfferingCardItem[],
  flexibleSolutions: {
    title: "Flexible Solutions",
    body: "From short executive briefings to in-depth learning programs designed to fit your organization’s needs, priorities, and scale.",
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
  eyebrow: "HOW WE TAILOR SUCCESSFUL PROGRAMS",
  title:
    "Our team will learn about your priorities and needs to find the right combination of learning modalities.",
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
  eyebrow: "MIT OPEN LEARNING’S APPROACH",
  title: "One continuum from literacy to fluency to specialization",
  body: "MIT Open Learning employs principles of instructional design and research into the science of learning to create progressive programs that develop real and impactful expertise.",
  steps: [
    {
      eyebrow: "01 . FOUNDATIONAL LITERACY",
      title: "Build understanding",
      body: "Develop a knowledge of the core principles behind specific, impactful technologies.",
    },
    {
      eyebrow: "02 . TECHNICAL FLUENCY",
      title: "Explore applications",
      body: "Deepen proficiency through practical application in ways that generate real, measurable impact.",
    },
    {
      eyebrow: "03 . SPECIALIZATION AND INNOVATION",
      title: "Drive transformation",
      body: "Employ expertise for impact at-scale.",
    },
  ] satisfies ContinuumStepItem[],
}

export const clientLogos = {
  eyebrow: "TRUSTED BY LEADING ORGANIZATIONS",
  logos: [
    {
      name: "BAE Systems",
      src: "/images/organizational_learning/client-logos/bae-systems.png",
      width: 160,
      height: 23,
    },
    {
      name: "Boeing",
      src: "/images/organizational_learning/client-logos/boeing.png",
      width: 160,
      height: 60,
    },
    {
      name: "Ford",
      src: "/images/organizational_learning/client-logos/ford.png",
      width: 160,
      height: 99,
    },
    {
      name: "Halliburton",
      src: "/images/organizational_learning/client-logos/halliburton.png",
      width: 160,
      height: 76,
    },
    {
      name: "IBM",
      src: "/images/organizational_learning/client-logos/ibm.png",
      width: 160,
      height: 73,
    },
    {
      name: "Shell",
      src: "/images/organizational_learning/client-logos/shell.png",
      width: 87,
      height: 80,
    },
  ] satisfies ClientLogoItem[],
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
      question: "How are the lectures by MIT faculty and experts structured?",
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
  title: "We’re ready to learn about your organization.",
  pitch:
    "You don’t need to have a program or solution mapped out before contacting us. Our team can help you explore challenges, identify the right approach, and guide you every step of the way.",
  assurances: [
    "Let’s start a conversation about your goals.",
    "We'll help you identify the right first step, for now or later.",
    "We take your data and privacy seriously.",
  ],
  submitLabel: "Talk with our team",
  audience: {
    label:
      "Who are you exploring learning for? This helps us connect you with the right team.",
    hint: "This helps us connect you with the right team.",
    organizationLabel: "My Organization",
    organizationDescription:
      "Businesses, government, universities, and other institutions",
    individualLabel: "Myself",
    individualDescription: "I want to learn on my own",
  },

  individual: {
    title: "Looking to learn on your own?",
    body: "Explore MIT courses, programs, and free learning opportunities designed for individual learners.",
    ctaLabel: "Explore learning for individuals",
  },
  success: {
    title: "Thanks — we'll be in touch.",
    body: "Our team will review what you shared and follow up by email. In the meantime, feel free to keep exploring MIT Learn.",
  },
  /** Rendered when no HubSpot form id is configured for the environment. */
  unavailable:
    "The contact form is unavailable right now. Please try again later.",
}
