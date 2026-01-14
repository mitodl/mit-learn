import {
  CourseRunV2,
  ProductFlexibilePrice,
} from "@mitodl/mitxonline-api-axios/v2"

const upgradeRunUrl = (product: ProductFlexibilePrice): string => {
  try {
    const url = new URL(
      "/cart/add",
      process.env.NEXT_PUBLIC_MITX_ONLINE_LEGACY_BASE_URL,
    )
    url.searchParams.append("product_id", String(product.id))
    return url.toString()
  } catch (err) {
    console.error("Error constructing upgrade URL:", err)
    return ""
  }
}

const canUpgrade = (run: CourseRunV2): boolean => {
  // Prefer to handle this on backend
  // See https://github.com/mitodl/hq/issues/9450
  return (
    run.is_enrollable &&
    !run.is_archived &&
    run.is_upgradable &&
    Boolean(run.products?.length)
  )
}

/**
 * Returns certificate price as formatted string, or null if upgrade not available
 */
const getCourseCertificatePrice = (run: CourseRunV2) => {
  if (!canUpgrade(run)) return null
  const product = run.products[0]
  const amount = product.price
  return Number(amount).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  })
}

export { getCourseCertificatePrice, canUpgrade, upgradeRunUrl }
