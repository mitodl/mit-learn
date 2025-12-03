"use client"

import React from "react"
import { useArticleDetail } from "api/hooks/articles"
import { LoadingSpinner, ArticleEditor } from "ol-components"
import { notFound } from "next/navigation"
import { Permission } from "api/hooks/user"
import RestrictedRoute from "@/components/RestrictedRoute/RestrictedRoute"

export const ArticleDetailPage = ({ articleId }: { articleId: number }) => {
  // const {
  //   data: article,
  //   isLoading,
  //   isFetching,
  // } = useArticleDetail(Number(articleId))

  // if (isLoading || isFetching) {
  //   return <LoadingSpinner color="inherit" loading size={32} />
  // }
  const article = {
    id: 1,
    title:
      "MITx MicroMasters celebrates 10 years of reimagining graduate-level education",
    content: {
      type: "doc",
      content: [
        {
          type: "banner",
          content: [
            {
              type: "heading",
              attrs: { textAlign: null, level: 1 },
              content: [
                {
                  type: "text",
                  text: "MITx MicroMasters celebrates 10 years of reimagining graduate-level education",
                },
              ],
            },
            {
              type: "paragraph",
              attrs: { textAlign: null },
              content: [
                {
                  type: "text",
                  text: "From personal stories of achievement to research that has transformed teaching and learning, learn more about the impact of the credential program developed in collaboration with MIT Open Learning and MIT departments.",
                },
              ],
            },
          ],
        },
        {
          type: "byline",
          attrs: {
            authorName: null,
            avatarUrl: null,
            readTime: null,
            publishedDate: null,
            editable: true,
          },
        },
        {
          type: "imageWithCaption",
          attrs: {
            src: "/mit-dome-2.jpg",
            alt: "IMG_20251013_090417075",
            title: "IMG_20251013_090417075",
            editable: true,
            caption:
              "MITx MicroMasters learners from the past 10 years. Image: MIT Open Learning",
            layout: "default",
          },
        },
        {
          type: "paragraph",
          attrs: { textAlign: null },
          content: [
            {
              type: "text",
              text: "This October marks an extraordinary milestone — ten years since MIT announced the groundbreaking MITx MicroMasters program.",
            },
          ],
        },
        {
          type: "paragraph",
          attrs: { textAlign: null },
          content: [
            {
              type: "text",
              text: "Offering learners everywhere a flexible and affordable pathway to a master’s degree, the MITx MicroMasters program began as a bold experiment in reimagining the graduate admissions process: learners who pass one or more proctored exams after completing a semester’s worth of graduate-level online courses, taught by MIT instructors, can accelerate their pursuit of an advanced degree — becoming more academically prepared while saving time and money.",
            },
          ],
        },
        {
          type: "paragraph",
          attrs: { textAlign: null },
          content: [
            {
              type: "text",
              text: "Participants in the pilot program in supply chain management (SCM) who earned the MicroMasters academic credential could apply for admission to MIT’s master’s degree program in SCM. Those who were admitted received course credit for the work they had completed online.",
            },
          ],
        },
        {
          type: "imageWithCaption",
          attrs: {
            src: "/mit-dome-2.jpg",
            alt: "IMG_20251013_090417075",
            title: "IMG_20251013_090417075",
            editable: true,
            caption: "Image: MIT News",
            layout: "default",
          },
        },
        {
          type: "heading",
          attrs: { textAlign: null, level: 2 },
          content: [
            {
              type: "text",
              text: "MIT’s first MicroMasters learners earn credentials (2017)",
            },
          ],
        },
        {
          type: "paragraph",
          attrs: { textAlign: null },
          content: [
            {
              type: "text",
              text: "MIT’s inaugural MicroMasters program in supply chain management drew more than 180,000 learners of all ages, from around the world. More than 1,100 learners finished all five of the courses required to earn the MicroMasters credential.",
            },
          ],
        },
        {
          type: "imageWithCaption",
          attrs: {
            src: "/mit-dome-2.jpg",
            alt: "IMG_20251013_090417075",
            title: "IMG_20251013_090417075",
            editable: true,
            caption: "Photo courtesy of Alan Al Yussef.",
            layout: "full",
          },
        },
        {
          type: "heading",
          attrs: { textAlign: null, level: 4 },
          content: [
            {
              type: "text",
              text: "Advancing career and academic ambitions with MITx MicroMasters Program in Finance (2025)",
            },
          ],
        },
        {
          type: "blockquote",
          content: [
            {
              type: "paragraph",
              attrs: { textAlign: null },
              content: [
                {
                  type: "text",
                  text: "“My story with the MITx MicroMasters Program is proof that no matter where you are — even if you’re in a small, developing country with limited resources — if you truly want to do something, you can achieve what you want,” says Satik Movsesyan, who completed the MITx MicroMasters Program in Finance following her graduation from the American University of Armenia in 2024.",
                },
              ],
            },
          ],
        },
        {
          type: "paragraph",
          attrs: { textAlign: null },
          content: [
            {
              type: "text",
              marks: [{ type: "italic" }],
              text: "In the coming year, we will celebrate the MITx MicroMasters 10th anniversary and all those who have learned with us. Dive deeper into the program’s impact and subscribe to our newsletter for the latest updates on anniversary events and activities.",
            },
          ],
        },
        {
          type: "heading",
          attrs: { textAlign: null, level: 2 },
          content: [{ type: "text", text: "Artificial intelligence" }],
        },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  attrs: { textAlign: null },
                  content: [
                    {
                      type: "text",
                      text: "Mathematics of Big Data and Machine Learning",
                      marks: [
                        {
                          type: "link",
                          attrs: {
                            href: "https://tiptap.dev/docs/editor/core-concepts/schema",
                            target: "_blank",
                            rel: "noopener noreferrer nofollow",
                            class: null,
                          },
                        },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  attrs: { textAlign: null },
                  content: [
                    {
                      type: "text",
                      text: "Foundation Models and Generative AI",
                      marks: [
                        {
                          type: "link",
                          attrs: {
                            href: "https://tiptap.dev/docs/editor/core-concepts/schema",
                            target: "_blank",
                            rel: "noopener noreferrer nofollow",
                            class: null,
                          },
                        },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  attrs: { textAlign: null },
                  content: [
                    { type: "text", text: "How to AI (Almost) Anything" },
                  ],
                },
              ],
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  attrs: { textAlign: null },
                  content: [
                    {
                      type: "text",
                      text: "Driving Innovation with Generative AI",
                      marks: [
                        {
                          type: "link",
                          attrs: {
                            href: "https://tiptap.dev/docs/editor/core-concepts/schema",
                            target: "_blank",
                            rel: "noopener noreferrer nofollow",
                            class: null,
                          },
                        },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  attrs: { textAlign: null },
                  content: [
                    {
                      type: "text",
                      text: "Designing and Building AI Products and Services",
                    },
                  ],
                },
              ],
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  attrs: { textAlign: null },
                  content: [
                    {
                      type: "text",
                      text: "Predictive Artificial Intelligence",
                    },
                  ],
                },
              ],
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  attrs: { textAlign: null },
                  content: [
                    { type: "text", text: "Deploying AI for Strategic Impact" },
                  ],
                },
              ],
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  attrs: { textAlign: null },
                  content: [{ type: "text", text: "AI for Senior Executives" }],
                },
              ],
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  attrs: { textAlign: null },
                  content: [
                    {
                      type: "text",
                      text: "AI and Cybersecurity: Strategies for Resilience and Defense",
                    },
                  ],
                },
              ],
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  attrs: { textAlign: null },
                  content: [
                    {
                      type: "text",
                      text: "AI Strategy and Leadership Program",
                    },
                  ],
                },
              ],
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  attrs: { textAlign: null },
                  content: [
                    { type: "text", text: "AI-Driven Computational Design" },
                  ],
                },
              ],
            },
          ],
        },
        {
          type: "imageWithCaption",
          attrs: {
            src: "/mit-dome-2.jpg",
            alt: "IMG_20251013_090417075",
            title: "IMG_20251013_090417075",
            editable: true,
            caption: "Photo courtesy of Alan Al Yussef.",
            layout: "wide",
          },
        },
        {
          type: "paragraph",
          attrs: { textAlign: null },
          content: [
            {
              type: "text",
              text: "Participants in the pilot program in supply chain management (SCM) who earned the MicroMasters academic credential could apply for admission to MIT’s master’s degree program in SCM. Those who were admitted received course credit for the work they had completed online.",
            },
          ],
        },
      ],
    },
  }
  if (!article) {
    return notFound()
  }
  return (
    // <RestrictedRoute requires={Permission.ArticleEditor}>
    <ArticleEditor article={article} readOnly />
    // </RestrictedRoute>
  )
}
