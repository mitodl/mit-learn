import { useEffect, useState } from "react"
import Image from "next/image"
import { styled } from "ol-components"
import { useVideoShortsList } from "api/hooks/videoShorts"
import useEmblaCarousel from "embla-carousel-react"
import { WheelGesturesPlugin } from "embla-carousel-wheel-gestures"
// import { ActionButton } from "@mitodl/smoot-design"
// import { RiArrowLeftLine, RiArrowRightLine } from "@remixicon/react"

const Overlay = styled.div({
  position: "fixed",
  top: 0,
  left: 0,
  width: "100%",
  height: "100%",
  backgroundColor: "rgba(0, 0, 0, 0.9)",
  zIndex: 1200,
})

const Carousel = styled.div({
  overflow: "hidden",
  margin: "24px 0",
})

const CarouselScroll = styled.div({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "24px",
})

const CarouselSlide = styled.div({
  // flex: "0 0 100%",
  height: "calc(100vh - 40px)",
  width: "calc((100vh - 40px) * 9 / 16)",
  // height: "800px",
  // width: "450px",
  // margin: "20px 0",
  overflow: "hidden",
  borderRadius: "12px",
  // border: "5px solid red",
})

type VideoShortsModalProps = {
  videoIndex: number
  videoData: any
}
const VideoShortsModal = ({ videoIndex, videoData }: VideoShortsModalProps) => {
  const { data } = useVideoShortsList()
  console.log("DATA", data)
  const [emblaRef, emblaApi] = useEmblaCarousel(
    {
      align: "start",
      loop: false,
      // skipSnaps: true,
      dragFree: true,
      // draggable: true,
      // containScroll: "trimSnaps",
      slidesToScroll: 5,
    },
    [WheelGesturesPlugin()],
  )

  const [canScrollPrev, setCanScrollPrev] = useState(false)
  const [canScrollNext, setCanScrollNext] = useState(true)

  // const [videoIndex, setVideoIndex] = useState(0)

  const scrollPrev = () => {
    emblaApi?.scrollPrev()
  }

  const scrollNext = () => {
    emblaApi?.scrollNext()
  }

  useEffect(() => {
    emblaApi?.on("scroll", () => {
      setCanScrollPrev(emblaApi.canScrollPrev())
      setCanScrollNext(emblaApi.canScrollNext())
    })
  }, [emblaApi])

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  return (
    <Overlay onWheel={handleWheel} onTouchMove={handleTouchMove}>
      <Carousel ref={emblaRef}>
        <CarouselScroll>
          {data?.map((item: any, index: number) => (
            <CarouselSlide key={index}>
              <iframe
                src={`https://youtube.com/embed/a6s6PK7Keew?si=gbiHIGhW2yBqAhxg`}
                width="100%"
                height="100%"
                title="YouTube video player"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              ></iframe>
            </CarouselSlide>
          ))}
        </CarouselScroll>
      </Carousel>
    </Overlay>
  )
}

export default VideoShortsModal
