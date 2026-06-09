type DataLayerPayload = Record<string, unknown>

declare global {
  interface Window {
    dataLayer?: DataLayerPayload[]
  }
}

const pushGtmEvent = (event: string, payload: DataLayerPayload = {}) => {
  if (typeof window === "undefined") return

  window.dataLayer = window.dataLayer || []
  window.dataLayer.push({
    event,
    ...payload,
  })
}

const trackCourseEnrolled = (courseName?: string | null) => {
  pushGtmEvent("course-enrolled", {
    ...(courseName ? { "course-enrolled-name": courseName } : {}),
  })
}

const trackCourseUnenrolled = (courseName?: string | null) => {
  pushGtmEvent("course-unenrolled", {
    ...(courseName ? { "course-enrolled-name": courseName } : {}),
  })
}

export { pushGtmEvent, trackCourseEnrolled, trackCourseUnenrolled }
