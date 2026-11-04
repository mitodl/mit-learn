import { env } from "@/env"
/* eslint-disable no-restricted-syntax */
import React from "react"
import type { AxiosError } from "axios"
import type { NextRequest } from "next/server"
import * as Sentry from "@sentry/nextjs"
import moment from "moment"
import { getQueryClient } from "@/app/getQueryClient"
import { certificateQueries } from "api/mitxonline-hooks/certificates"
import {
  V2CourseRunCertificate,
  V2ProgramCertificate,
  SignatoryItem,
} from "@mitodl/mitxonline-api-axios/v2"
import {
  Document,
  Page,
  View,
  Text,
  Svg,
  G,
  Path,
  Font,
  Image,
  pdf,
} from "@react-pdf/renderer"
import { redirect } from "next/navigation"
import { pxToPt } from "./utils"
import {
  getCertificateBadgeLines,
  getCertificateBadgeTypography,
  getCertificateTitle,
} from "@/common/certificateUtils"

// https://use.typekit.net/lbk1xay.css
Font.register({
  family: "Neue Haas Grotesk Text 400",
  src: "https://use.typekit.net/af/0230dd/00000000000000007735bb33/30/a?primer=7cdcb44be4a7db8877ffa5c0007b8dd865b3bbc383831fe2ea177f62257a9191&fvd=n4&v=3",
})
Font.register({
  family: "Neue Haas Grotesk Text 500",
  src: "https://use.typekit.net/af/1ba16c/00000000000000007735bb5a/30/a?primer=7fa3915bdafdf03041871920a205bef951d72bf64dd4c4460fb992e3ecc3a862&fvd=n5&v=3",
})
Font.register({
  family: "Neue Haas Grotesk Text 600",
  src: "https://use.typekit.net/af/153042/00000000000000007735bb62/30/a?primer=7fa3915bdafdf03041871920a205bef951d72bf64dd4c4460fb992e3ecc3a862&fvd=n6&v=3",
})
Font.register({
  family: "Neue Haas Grotesk Text 700",
  src: "https://use.typekit.net/af/305037/00000000000000007735bb39/30/l?primer=7cdcb44be4a7db8877ffa5c0007b8dd865b3bbc383831fe2ea177f62257a9191&fvd=n7&v=3",
})

/* Fallback fonts for non-Latin characters (hq#12554, hq#12475).
 * Neue Haas Grotesk is a Latin-only typeface, and @react-pdf/renderer performs
 * no automatic system-font fallback the way a browser does. Without these,
 * user-supplied text with glyphs outside Neue Haas Grotesk's set — CJK names
 * (e.g. 志云 黄) and extended-Latin letters (e.g. Turkish Ğ) — renders garbled.
 *
 * Noto Sans (latin-ext) covers extended-Latin; Noto Sans SC / TC cover
 * Simplified / Traditional Chinese. They are only ever *used* for characters
 * the brand font can't render (react-pdf falls back per-character), so branded
 * text stays in Neue Haas Grotesk. Served from a version-pinned CDN, matching
 * the remote-font approach already used above for the brand font.
 *
 * Note: this only affects the PDF/print output — the live web page is unaffected
 * (it uses its own font stack with the browser's built-in fallback).
 */
const FONTSOURCE_CDN = "https://cdn.jsdelivr.net/fontsource/fonts"
Font.register({
  family: "Noto Sans 400",
  src: `${FONTSOURCE_CDN}/noto-sans@5.3.0/latin-ext-400-normal.ttf`,
})
Font.register({
  family: "Noto Sans 700",
  src: `${FONTSOURCE_CDN}/noto-sans@5.3.0/latin-ext-700-normal.ttf`,
})
Font.register({
  family: "Noto Sans SC 400",
  src: `${FONTSOURCE_CDN}/noto-sans-sc@5.3.0/chinese-simplified-400-normal.ttf`,
})
Font.register({
  family: "Noto Sans SC 700",
  src: `${FONTSOURCE_CDN}/noto-sans-sc@5.3.0/chinese-simplified-700-normal.ttf`,
})
Font.register({
  family: "Noto Sans TC 400",
  src: `${FONTSOURCE_CDN}/noto-sans-tc@5.3.0/chinese-traditional-400-normal.ttf`,
})
Font.register({
  family: "Noto Sans TC 700",
  src: `${FONTSOURCE_CDN}/noto-sans-tc@5.3.0/chinese-traditional-700-normal.ttf`,
})

/* Font-family stacks: brand font first, then fallbacks for glyphs it lacks.
 * Use these instead of the bare "Neue Haas Grotesk Text NNN" strings so every
 * text element gets per-character fallback. Only the 400 and 700 weights are
 * used on the certificate.
 */
const FONT_STACK_400 = [
  "Neue Haas Grotesk Text 400",
  "Noto Sans 400",
  "Noto Sans SC 400",
  "Noto Sans TC 400",
]
const FONT_STACK_700 = [
  "Neue Haas Grotesk Text 700",
  "Noto Sans 700",
  "Noto Sans SC 700",
  "Noto Sans TC 700",
]

// Disables hyphenation on word wrap
Font.registerHyphenationCallback((word) => [word])

const colors = {
  black: "#000000",
  red: "#A31F34",
  silverGray: "#8B959E",
  silverGrayDark: "#626A73",
  lightGray2: "#DDE1E6",
  white: "#FFFFFF",
}

/* Type styles from the Figma certificate, in Figma pixels.
 * - Font weights are not respected as the supported font formats are only available in one file per font weight (registered above)
 * - react-pdf treats a unitless lineHeight as a multiple of fontSize, so line heights are given as ratios.
 */
const textStyle = (
  fontFamily: string[],
  fontSizePx: number,
  lineHeightPx: number,
) => ({
  fontFamily,
  fontSize: pxToPt(fontSizePx),
  lineHeight: lineHeightPx / fontSizePx,
})

const typography = {
  name: textStyle(FONT_STACK_700, 48, 60),
  h3: textStyle(FONT_STACK_700, 28, 36),
  h4: textStyle(FONT_STACK_700, 24, 30),
  h5: textStyle(FONT_STACK_700, 18, 26),
  body18: textStyle(FONT_STACK_400, 18, 26),
  body2: textStyle(FONT_STACK_400, 14, 18),
}

/* SVGs can not be used a Image source (there are workarounds, though they would render rasterized).
 * Additionally we cannot use our existing SVGs as we need to used react-pdf components for mapping to PDF primitives.
 */
const OpenLearningLogo = () => (
  <Svg
    viewBox="0 0 260 67"
    fill="none"
    style={{
      width: pxToPt(260),
      height: pxToPt(67),
    }}
  >
    <G clip-path="url(#clip0_22738_68399)">
      <Path
        d="M60.0756 60.8451H73.4258V20.6102H60.0756V60.8451ZM80.1008 13.9044H113.476V0.492798H80.1008V13.9044ZM60.0756 0.492798H73.4258V13.9044H60.0756V0.492798ZM40.0504 60.8451H53.4006V0.492798H40.0504V60.8451ZM20.0252 47.4335H33.3754V0.492798H20.0252V47.4335ZM0 60.8451H13.3501V0.492798H0V60.8451ZM80.1008 60.8451H93.451V20.6102H80.1008V60.8451Z"
        fill="black"
      />
      <Path
        d="M128.752 35.6979H133.828V56.5893H145.592V60.8451H128.752V35.6979Z"
        fill="black"
      />
      <Path
        d="M146.711 51.8062C146.711 46.4602 150.317 42.3101 155.569 42.3101C161.345 42.3101 164.426 46.7416 164.426 53.1778H151.403C151.753 55.9563 153.293 57.6797 155.989 57.6797C157.844 57.6797 158.93 56.8356 159.455 55.4638H164.146C163.481 58.6644 160.645 61.3726 156.024 61.3726C150.072 61.3727 146.711 57.1872 146.711 51.8062ZM151.473 49.8718H159.455C159.315 47.5857 157.809 46.003 155.639 46.003C153.118 46.003 151.893 47.5153 151.473 49.8718Z"
        fill="black"
      />
      <Path
        d="M177.379 58.8402H177.309C176.399 60.2119 175.104 61.2671 172.023 61.2671C168.347 61.2671 165.756 59.3327 165.756 55.7453C165.756 51.7709 168.977 50.5048 172.968 49.9421C175.944 49.52 177.31 49.2738 177.31 47.9022C177.31 46.6009 176.294 45.7567 174.299 45.7567C172.058 45.7567 170.973 46.5656 170.833 48.289H166.597C166.737 45.1236 169.082 42.3452 174.334 42.3452C179.725 42.3452 181.896 44.772 181.896 48.9925V58.172C181.896 59.5436 182.106 60.3527 182.526 60.6691V60.845H177.94C177.66 60.4933 177.485 59.6491 177.379 58.8402ZM177.415 54.4791V51.7709C176.574 52.2634 175.279 52.5447 174.089 52.8261C171.603 53.3888 170.378 53.9515 170.378 55.6397C170.378 57.3279 171.498 57.9257 173.178 57.9257C175.909 57.9258 177.415 56.2376 177.415 54.4791Z"
        fill="black"
      />
      <Path
        d="M189.492 45.6864H189.597C190.682 43.6465 191.908 42.5914 194.008 42.5914C194.533 42.5914 194.848 42.6266 195.129 42.7321V46.9175H195.024C191.908 46.6009 189.667 48.2539 189.667 52.0524V60.8451H184.906V42.8024H189.492L189.492 45.6864Z"
        fill="black"
      />
      <Path
        d="M201.85 45.2644H201.955C203.18 43.33 204.826 42.3101 207.277 42.3101C210.988 42.3101 213.473 45.1236 213.473 49.0629V60.8452H208.712V49.7663C208.712 47.832 207.592 46.4603 205.596 46.4603C203.496 46.4603 201.955 48.1486 201.955 50.6105V60.8452H197.194V42.8024H201.85L201.85 45.2644Z"
        fill="black"
      />
      <Path
        d="M216.414 35.6979H221.175V39.9887H216.414V35.6979ZM216.414 42.8024H221.175V60.8451H216.414V42.8024Z"
        fill="black"
      />
      <Path
        d="M228.912 45.2644H229.017C230.242 43.33 231.888 42.3101 234.339 42.3101C238.05 42.3101 240.535 45.1236 240.535 49.0629V60.8452H235.774V49.7663C235.774 47.832 234.654 46.4603 232.658 46.4603C230.558 46.4603 229.017 48.1486 229.017 50.6105V60.8452H224.256V42.8024H228.912L228.912 45.2644Z"
        fill="black"
      />
      <Path
        d="M242.985 61.3727H247.712C248.097 62.4981 249.112 63.3774 251.318 63.3774C254.013 63.3774 255.309 62.0761 255.309 59.6141V57.6445H255.204C254.153 58.8403 252.788 59.7547 250.512 59.7547C246.521 59.7547 242.6 56.5893 242.6 51.1379C242.6 45.7568 245.821 42.3101 250.372 42.3101C252.613 42.3101 254.258 43.1893 255.344 44.7017H255.414V42.8024H260V59.4734C260 62.0057 259.195 63.7292 257.864 64.9601C256.359 66.3669 254.048 67 251.387 67C246.486 67 243.475 64.8897 242.985 61.3727ZM255.554 51.0324C255.554 48.3945 254.153 46.1436 251.283 46.1436C248.867 46.1436 247.256 48.0429 247.256 51.0675C247.256 54.1274 248.867 55.9211 251.318 55.9211C254.328 55.9212 255.554 53.7054 255.554 51.0324Z"
        fill="black"
      />
      <Path
        d="M127.667 13.1187C127.667 5.59223 132.358 0 139.745 0C147.132 0 151.788 5.59223 151.788 13.1187C151.788 20.6453 147.132 26.2023 139.745 26.2023C132.358 26.2023 127.667 20.6453 127.667 13.1187ZM146.607 13.1187C146.607 8.0893 144.366 4.18535 139.78 4.18535C135.194 4.18535 132.848 8.0893 132.848 13.1187C132.848 18.113 135.194 22.0169 139.78 22.0169C144.366 22.0169 146.607 18.113 146.607 13.1187Z"
        fill="black"
      />
      <Path
        d="M154.168 7.59693H158.755V9.8479H158.86C160.015 8.26524 161.696 7.10455 164.146 7.10455C168.907 7.10455 171.953 11.0085 171.953 16.6359C171.953 22.4742 168.802 26.1672 164.181 26.1672C161.66 26.1672 160.015 25.1472 159 23.5997H158.93V31.5482H154.168V7.59693ZM167.122 16.7765C167.122 13.365 165.932 10.9734 162.991 10.9734C160.015 10.9734 158.825 13.5409 158.825 16.7765C158.825 20.0474 160.33 22.1928 163.166 22.1928C165.582 22.1928 167.122 20.1881 167.122 16.7765Z"
        fill="black"
      />
      <Path
        d="M173.283 16.6006C173.283 11.2547 176.889 7.10455 182.141 7.10455C187.917 7.10455 190.998 11.5361 190.998 17.9723H177.974C178.325 20.7508 179.865 22.4742 182.561 22.4742C184.416 22.4742 185.502 21.6301 186.027 20.2583H190.718C190.053 23.4589 187.217 26.1671 182.596 26.1671C176.644 26.1672 173.283 21.9817 173.283 16.6006ZM178.045 14.6663H186.027C185.887 12.3802 184.381 10.7975 182.211 10.7975C179.69 10.7974 178.465 12.3098 178.045 14.6663Z"
        fill="black"
      />
      <Path
        d="M197.859 10.0589H197.964C199.19 8.12451 200.835 7.10455 203.286 7.10455C206.997 7.10455 209.483 9.91814 209.483 13.8574V25.6397H204.721V14.5608C204.721 12.6265 203.601 11.2548 201.605 11.2548C199.505 11.2548 197.964 12.943 197.964 15.405V25.6397H193.203V7.59693H197.859L197.859 10.0589Z"
        fill="black"
      />
    </G>
  </Svg>
)

const Badge = ({ programType }: { programType?: string | null }) => {
  const lines = getCertificateBadgeLines(programType)
  const { fontSizePx, lineHeightPx, registeredMarkScale } =
    getCertificateBadgeTypography(programType)
  const badgeStyle = textStyle(FONT_STACK_700, fontSizePx, lineHeightPx)
  const badgeMarkStyle = {
    fontSize: pxToPt(fontSizePx * registeredMarkScale),
  }

  return (
    <View
      style={{
        position: "absolute",
        // Offsets are measured from the outer edge of the content border
        top: pxToPt(0),
        right: pxToPt(46),
      }}
    >
      {/* Matches public/images/certificate-badge-desktop.svg */}
      <Svg
        viewBox="0 0 230 360"
        fill="none"
        style={{
          width: pxToPt(230),
          height: pxToPt(360),
        }}
      >
        <G transform="translate(46 0)">
          <Path d="M137 360L68.4992 321.87L0 360V0H137V360Z" fill="#DDE1E6" />
        </G>
        <G transform="translate(0 64)">
          <Path
            d="M230.001 111.74C230.001 123.98 221.176 134.512 217.476 145.329C214.06 156.715 214.914 170.663 208.082 180.057C201.251 189.451 188.156 192.866 178.763 199.698C169.369 206.53 162.253 218.485 151.152 222.186C140.335 225.886 127.525 220.478 115.855 220.478C103.899 220.478 91.0897 225.886 80.5575 222.186C69.1714 218.485 62.055 206.53 52.9461 199.698C43.5525 192.866 30.1739 189.451 23.3422 180.057C16.5105 170.663 17.6491 156.715 13.9486 145.329C10.5328 134.512 1.42383 123.98 1.42383 111.74C1.42383 99.5001 10.5328 88.9679 13.9486 78.1511C17.6491 66.765 16.5105 52.817 23.3422 43.4234C30.1739 34.0299 43.5525 30.614 52.9461 23.7823C62.055 16.9506 69.1714 4.99517 80.5575 1.29467C91.0897 -2.40582 103.899 3.00261 115.855 3.00261C127.525 3.00261 140.335 -2.40582 151.152 1.29467C162.253 4.99517 169.369 16.9506 178.763 23.7823C188.156 30.614 201.251 34.0299 208.082 43.4234C214.914 52.817 214.06 66.765 217.476 78.1511C221.176 88.9679 230.001 99.5001 230.001 111.74Z"
            fill="#750014"
          />
          <Path
            d="M228.577 112.878C228.577 124.834 219.752 135.366 216.052 146.183C212.351 157.284 213.49 170.948 206.658 180.057C199.827 189.45 186.448 192.866 177.339 199.698C167.946 206.245 160.829 217.915 149.728 221.616C138.911 225.032 126.101 219.908 114.146 219.908C102.475 219.908 89.6658 225.032 78.849 221.616C67.7475 217.915 60.6312 206.245 51.2376 199.698C41.844 192.866 28.75 189.45 21.9183 180.057C15.0867 170.948 15.9407 157.284 12.5248 146.183C8.82432 135.366 0 124.834 0 112.878C0 100.923 8.82432 90.6754 12.5248 79.8586C15.9407 68.7571 15.0867 55.0937 21.9183 45.7002C28.75 36.5913 41.844 33.1754 51.2376 26.3438C60.6312 19.5121 67.7475 7.84126 78.849 4.42542C89.6658 0.724925 102.475 5.84869 114.146 5.84869C126.101 5.84869 138.911 0.724925 149.728 4.42542C160.829 7.84126 167.946 19.5121 177.339 26.3438C186.448 33.1754 199.827 36.5913 206.658 45.7002C213.49 55.0937 212.351 68.7571 216.052 79.8586C219.752 90.6754 228.577 100.923 228.577 112.878Z"
            fill="#750014"
          />
        </G>
        <G transform="translate(21.0644 84.082)">
          <Path
            d="M179.901 89.9505C179.901 139.48 139.48 179.901 89.9504 179.901C40.4207 179.901 0 139.48 0 89.9505C0 40.4208 40.4207 0 89.9504 0C139.48 0 179.901 40.4208 179.901 89.9505Z"
            fill="#212326"
            fillOpacity="0.2"
          />
        </G>
        <G transform="translate(26.1875 90.0605)">
          <Path
            d="M179.616 89.9505C179.616 139.48 139.48 179.616 89.9505 179.616C40.1362 179.616 0 139.48 0 89.9505C0 40.1362 40.1362 0 89.9505 0C139.48 0 179.616 40.1362 179.616 89.9505Z"
            fill="#212326"
            fillOpacity="0.2"
          />
        </G>
        <G transform="translate(24.4805 87.498)">
          <Path
            d="M179.616 89.6658C179.616 139.48 139.48 179.616 89.6658 179.616C40.1361 179.616 0 139.48 0 89.6658C0 40.1361 40.1361 0 89.6658 0C139.48 0 179.616 40.1361 179.616 89.6658Z"
            fill="#83192A"
          />
        </G>
      </Svg>
      {/* Spans twice the seal's center height so the label centers on the seal */}
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: pxToPt(230),
          height: pxToPt(177 * 2),
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text
          style={{
            ...badgeStyle,
            color: colors.white,
            textAlign: "center",
          }}
        >
          {lines.primary}
          {lines.registeredMark ? <Text style={badgeMarkStyle}>®</Text> : null}
        </Text>
        {lines.secondary ? (
          <Text
            style={{
              ...badgeStyle,
              color: colors.white,
              textAlign: "center",
            }}
          >
            {lines.secondary}
          </Text>
        ) : null}
      </View>
    </View>
  )
}

enum CertificateType {
  Course = "course",
  Program = "program",
}

const CertificateDoc = ({
  uuid,
  title,
  badgeProgramType,
  userName,
  ceus,
  signatories,
  issueDate,
}: {
  uuid: string
  title: string
  badgeProgramType?: string | null
  userName: string
  ceus?: string | null
  signatories: SignatoryItem[]
  issueDate?: string | null
}) => {
  return (
    <Document
      title={`${title} Certificate issued by MIT Open Learning.pdf`}
      author="MIT Open Learning"
      pageLayout="singlePage"
    >
      {/* The page is the Figma frame: 1414 x 1093px maps onto Letter landscape */}
      <Page
        size="LETTER"
        orientation="landscape"
        dpi={72}
        style={{
          flexDirection: "column",
          backgroundColor: colors.white,
          padding: pxToPt(32),
        }}
      >
        <View
          style={{
            flexGrow: 1,
            flexDirection: "column",
            position: "relative",
            borderWidth: pxToPt(2),
            borderStyle: "solid",
            borderColor: colors.silverGray,
            // Figma draws the stroke inside the frame, so content sits 64px from the outer edge
            padding: pxToPt(62),
            gap: pxToPt(64),
            fontFamily: FONT_STACK_400,
          }}
        >
          <OpenLearningLogo />
          <Badge programType={badgeProgramType} />

          <View
            style={{
              flexDirection: "column",
              gap: pxToPt(12),
              // Keeps the name clear of the stamp; long names wrap
              paddingRight: pxToPt(230),
            }}
          >
            <Text style={{ ...typography.h4, color: colors.silverGrayDark }}>
              This is to certify that
            </Text>
            <Text style={{ ...typography.name, color: colors.red }}>
              {userName}
            </Text>
          </View>

          <View
            style={{
              flexGrow: 1,
              flexDirection: "column",
              gap: pxToPt(12),
            }}
          >
            <Text
              style={{ ...typography.body18, color: colors.silverGrayDark }}
            >
              has successfully completed all requirements of:
            </Text>
            <Text style={{ ...typography.h3, color: colors.black }}>
              {title}
            </Text>
            {ceus ? (
              <Text
                style={{ ...typography.body18, color: colors.silverGrayDark }}
              >
                Awarded {ceus} Continuing Education Units (CEUs)
              </Text>
            ) : null}
            {issueDate && (
              <Text
                style={{ ...typography.body18, color: colors.silverGrayDark }}
              >
                Awarded on {moment(issueDate).format("MMMM D, YYYY")}
              </Text>
            )}
          </View>

          <View
            style={{
              flexDirection: "column",
              gap: pxToPt(16),
              paddingTop: pxToPt(24),
              borderTopWidth: pxToPt(1),
              borderTopStyle: "solid",
              borderTopColor: colors.lightGray2,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                rowGap: pxToPt(16),
                columnGap: pxToPt(12),
              }}
            >
              {signatories?.map((signatory, index) => (
                <View
                  key={index}
                  style={{
                    flexDirection: "column",
                    gap: pxToPt(4),
                    width: pxToPt(296),
                  }}
                >
                  <Image
                    source={
                      signatory.signature_image.startsWith("http")
                        ? signatory.signature_image
                        : `${env("NEXT_PUBLIC_MITX_ONLINE_BASE_URL")}${signatory.signature_image}`
                    }
                    style={{
                      alignSelf: "flex-start",
                      height: pxToPt(40),
                      maxWidth: pxToPt(296),
                      objectFit: "contain",
                    }}
                  />
                  <View style={{ flexDirection: "column", gap: pxToPt(4) }}>
                    <Text style={{ ...typography.h5, color: colors.black }}>
                      {signatory.name}
                    </Text>
                    {[
                      signatory.title_1,
                      signatory.title_2,
                      signatory.title_3,
                      signatory.organization,
                    ]
                      .filter(Boolean)
                      .map((line, lineIndex) => (
                        <Text
                          key={lineIndex}
                          style={{
                            ...typography.body2,
                            color: colors.silverGrayDark,
                          }}
                        >
                          {line}
                        </Text>
                      ))}
                  </View>
                </View>
              ))}
            </View>
            <Text style={{ ...typography.body2, color: colors.black }}>
              Valid Credential ID:{" "}
              <Text style={{ color: colors.silverGrayDark }}>{uuid}</Text>
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}

const CourseCertificate = ({
  certificate,
}: {
  certificate: V2CourseRunCertificate
}) => {
  const title = getCertificateTitle(
    certificate?.certificate_page?.product_name,
    certificate?.course_run?.course?.title ?? "",
  )

  const userName = certificate?.user?.name

  const ceus = certificate?.certificate_page?.CEUs

  const signatories = certificate?.certificate_page?.signatory_items

  const issueDate = certificate?.issue_date

  return (
    <CertificateDoc
      title={title}
      userName={userName!}
      ceus={ceus}
      signatories={signatories}
      issueDate={issueDate}
      uuid={certificate.uuid}
    />
  )
}

const ProgramCertificate = ({
  certificate,
}: {
  certificate: V2ProgramCertificate
}) => {
  const title = getCertificateTitle(
    certificate?.certificate_page?.product_name,
    certificate?.program?.title ?? "",
  )

  const userName = certificate?.user?.name

  const ceus = certificate?.certificate_page?.CEUs

  const signatories = certificate?.certificate_page?.signatory_items

  const issueDate = certificate?.issue_date

  return (
    <CertificateDoc
      uuid={certificate.uuid}
      title={title}
      badgeProgramType={certificate?.program?.program_type}
      userName={userName!}
      ceus={ceus}
      signatories={signatories}
      issueDate={issueDate}
    />
  )
}

type RouteContext = {
  params: Promise<{ certificateType: string; uuid: string }>
}

export async function GET(req: NextRequest, ctx: RouteContext) {
  const { certificateType, uuid } = await ctx.params

  const queryClient = getQueryClient()

  let pdfDoc

  try {
    if (certificateType === CertificateType.Course) {
      const certificate = await queryClient.fetchQuery(
        certificateQueries.courseCertificatesRetrieve({
          uuid,
        }),
      )

      pdfDoc = pdf(<CourseCertificate certificate={certificate} />)
    } else {
      const certificate = await queryClient.fetchQuery(
        certificateQueries.programCertificatesRetrieve({
          uuid,
        }),
      )
      pdfDoc = pdf(<ProgramCertificate certificate={certificate} />)
    }
  } catch (error) {
    if ([400, 404].includes((error as AxiosError).status ?? -1)) {
      return redirect("/not-found")
    }
    Sentry.captureException(error)
    console.error("Error fetching certificate for PDF generation", {
      certificateType,
      uuid,
      error,
    })
    return new Response("Error generating certificate", {
      status:
        typeof (error as AxiosError).status === "number"
          ? (error as AxiosError).status
          : 500,
    })
  }

  const pdfStream = await pdfDoc.toBuffer()

  return new Response(pdfStream as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="certificate-${uuid}.pdf"`,
    },
  })
}
