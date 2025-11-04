"use client"

import React, { useEffect, useState } from "react"
import { useArticleDetail } from "api/hooks/articles"
import "ckeditor5/ckeditor5.css"
import "./styles.css"

import { Swiper, SwiperSlide } from "swiper/react"
import { Navigation, Pagination, Autoplay } from "swiper/modules"

import "swiper/css"
import "swiper/css/navigation"
import "swiper/css/pagination"

export const ArticleDetail = ({ articleId }: { articleId: number }) => {
  const id = Number(articleId)
  const { data, isLoading } = useArticleDetail(id)

  const [cleanHtml, setCleanHtml] = useState("")
  const [carouselItems, setCarouselItems] = useState<string[]>([])

  useEffect(() => {
    if (!data?.html) return

    const parser = new DOMParser()
    const doc = parser.parseFromString(data.html, "text/html")

    const cards = Array.from(doc.querySelectorAll(".carousel-course-card"))

    // ✅ Add new class to each card before storing HTML
    cards.forEach((el) => {
      el.classList.add("carousel-slide-item")
    })

    setCarouselItems(cards.map((el) => el.outerHTML))
    cards.forEach((el) => el.remove())

    setCleanHtml(doc.body.innerHTML)
  }, [data])

  if (isLoading) return <div>Loading article...</div>
  if (!data) return <div>Article not found.</div>

  return (
    <div className="article-detail-container">
      <h1 className="article-title">{data.title}</h1>

      {/* ✅ Swiper slider */}
      {carouselItems.length > 0 && (
        <div className="course-carousel-wrapper">
          <Swiper
            modules={[Navigation, Pagination, Autoplay]}
            spaceBetween={16}
            slidesPerView={1.2}
            navigation
            pagination={{ clickable: true }}
            autoplay={{
              delay: 2500,
              disableOnInteraction: false,
            }}
            breakpoints={{
              640: { slidesPerView: 2.2 },
              1024: { slidesPerView: 3.2 },
            }}
          >
            {carouselItems.map((item, idx) => (
              <SwiperSlide key={idx}>
                <div
                  className="course-card-wrapper"
                  dangerouslySetInnerHTML={{ __html: item }}
                />
              </SwiperSlide>
            ))}
          </Swiper>
        </div>
      )}

      <div
        className="ck-content"
        dangerouslySetInnerHTML={{ __html: cleanHtml }}
      />
    </div>
  )
}

export default ArticleDetail
