const API_BASE_URL = process.env.NEXT_PUBLIC_MITXONLINE_API_BASE_URL

const enrollment = {
  courseEnrollment: `${API_BASE_URL}/api/v1/enrollments/`,
}

export { enrollment }
