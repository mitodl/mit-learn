/* Enables use of the CertificatePage pixel units styles
  - Browsers print at 96 dpi, PDFs default to 72 dpi
  - Scaling factor of 0.8 emulates browser print scaling and better reflect the screen design
*/
const PRINT_SCALING_FACTOR = 0.8

export const pxToPt = (px: number): number => {
  return px * (72 / 96) * PRINT_SCALING_FACTOR
}

/**
 * Calculate font size and top position for user name based on estimated text width
 * to ensure long names fit on the certificate while maintaining baseline alignment
 */
export const getNameStyles = (
  name: string,
): { fontSize: number; top: number } => {
  const baselineTop = pxToPt(206) // Original top position for full-size name
  const baseFontSize = pxToPt(52) // h1 font size
  const maxWidth = pxToPt(950) // Maximum available width

  // For Neue Haas Grotesk at 52px, approximate average char width is ~60% of font size
  const avgCharWidth = baseFontSize * 0.6

  const estimatedWidth = name.length * avgCharWidth

  let scaleFactor = 1.0
  if (estimatedWidth > maxWidth) {
    scaleFactor = Math.max(0.35, maxWidth / estimatedWidth)
  }

  const fontSize = baseFontSize * scaleFactor

  // Keep the baseline in the same position
  const fontSizeDiff = baseFontSize - fontSize
  const top = baselineTop + fontSizeDiff

  return { fontSize, top }
}
