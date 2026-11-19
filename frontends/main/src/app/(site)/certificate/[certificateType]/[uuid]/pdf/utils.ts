/* Maps the certificate's Figma pixel units onto the PDF page.
  - The Figma certificate frame is 1414 x 1093px, which is US Letter landscape
  - US Letter landscape is 792 x 612pt, so the frame fills the page exactly
*/
const DESIGN_WIDTH_PX = 1414
const LETTER_LANDSCAPE_WIDTH_PT = 792

export const pxToPt = (px: number): number => {
  return px * (LETTER_LANDSCAPE_WIDTH_PT / DESIGN_WIDTH_PX)
}
