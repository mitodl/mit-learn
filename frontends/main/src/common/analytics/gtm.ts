type DataLayerPayload = Record<string, unknown>

declare global {
  interface Window {
    dataLayer?: DataLayerPayload[]
  }
}

const pushGtmEvent = (event: string, payload: DataLayerPayload = {}) => {
  if (typeof window === "undefined") return

  try {
    window.dataLayer = window.dataLayer || []
    window.dataLayer.push({
      ...payload,
      event,
    })
  } catch {
    // Prevent analytics failures from impacting the app flow.
  }
}

const trackCourseEnrolled = (courseName?: string | null) => {
  pushGtmEvent("course-enrolled", {
    ...(courseName ? { "course-enrolled-name": courseName } : {}),
  })
}

const trackProgramEnrolled = (programName?: string | null) => {
  pushGtmEvent("program-enrolled", {
    ...(programName ? { "program-enrolled-name": programName } : {}),
  })
}

const trackCourseUnenrolled = (courseName?: string | null) => {
  pushGtmEvent("course-unenrolled", {
    ...(courseName
      ? {
          "course-unenrolled-name": courseName,
          // Backward compatibility for any existing GTM variables.
          "course-enrolled-name": courseName,
        }
      : {}),
  })
}

const trackProgramUnenrolled = (programName?: string | null) => {
  pushGtmEvent("program-unenrolled", {
    ...(programName
      ? {
          "program-unenrolled-name": programName,
          // Backward compatibility for any existing GTM variables.
          "program-enrolled-name": programName,
        }
      : {}),
  })
}

export {
  pushGtmEvent,
  trackCourseEnrolled,
  trackProgramEnrolled,
  trackCourseUnenrolled,
  trackProgramUnenrolled,
}
