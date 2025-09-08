import React from "react"
import type { NextRequest } from "next/server"
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
  Svg,
  G,
  Path,
  Font,
  Image,
  pdf,
  Rect,
  Link,
} from "@react-pdf/renderer"
import moment from "moment"

/* Enables use of the CertificatePage pixel units styles
  - Browsers print at 96 dpi, PDFs default to 72 dpi
  - Scaling factor of 0.8 emulates browser print scaling and better reflect the screen design
*/
const pxToPt = (px: number): number => {
  return px * (72 / 96) * 0.8
}

const formatDate = (
  /**
   * Date string or date.
   */
  date: string,
  /**
   * A Moment.js format string. See https://momentjs.com/docs/#/displaying/format/
   */
  format = "MMM D, YYYY",
) => {
  return moment(date).format(format)
}

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

// Disable hyphenation on word wrap
Font.registerHyphenationCallback((word) => [word])

const colors = {
  mitRed: "#750014",
  brightRed: "#FF1423",
  black: "#000000",
  white: "#FFFFFF",
  darkGray2: "#212326",
  darkGray1: "#40464C",
  silverGrayDark: "#626A73",
  silverGray: "#8B959E",
  silverGrayLight: "#B8C2CC",
  lightGray2: "#DDE1E6",
  lightGray1: "#F3F4F8",
  navGray: "#303337",
  darkPink: "#750062",
  pink: "#FF14F0",
  lightPink: "#FFB3FF",
  darkPurple: "#3E006B",
  purple: "#93F",
  lightPurple: "#BFB3FF",
  darkBlue: "#002896",
  blue: "#1966FF",
  lightBlue: "#99EBFF",
  darkGreen: "#004D1A",
  green: "#00AD00",
  lightGreen: "#AF3",
  darkRed: "#83192A",
  red: "#A31F34",
  lightRed: "#D02E44",
  orange: "#FAB005",
  yellow: "#FFEB00",
}

const fontWeights = {
  text: {
    roman: 400,
    medium: 500,
    bold: 700,
  },
}

// const pxToPt = (px: number) => `${px / 16}rem`

const theme = {
  // Note: Figma calls this "Neue Haas Grotesk Text", but that is incorrect based on Adobe's font family.
  fontFamily: "neue-haas-grotesk-text, sans-serif",
  fontWeightLight: fontWeights.text.roman,
  fontWeightRegular: fontWeights.text.roman,
  fontWeightMedium: fontWeights.text.medium,
  fontWeightBold: fontWeights.text.bold,
  h1: {
    fontFamily: "Neue Haas Grotesk Text 700",
    fontWeight: fontWeights.text.bold,
    // fontStyle: "normal",
    fontSize: pxToPt(52),
    lineHeight: pxToPt(60),
  },
  h2: {
    fontFamily: "Neue Haas Grotesk Text 700",
    fontWeight: fontWeights.text.bold,
    // fontStyle: "normal",
    fontSize: pxToPt(34),
    lineHeight: pxToPt(40),
  },
  h3: {
    fontFamily: "Neue Haas Grotesk Text 700",
    fontWeight: fontWeights.text.bold,
    // fontStyle: "normal",
    fontSize: pxToPt(28),
    lineHeight: pxToPt(36),
  },
  h4: {
    fontFamily: "Neue Haas Grotesk Text 700",
    fontWeight: fontWeights.text.bold,
    // fontStyle: "normal",
    fontSize: pxToPt(24),
    lineHeight: pxToPt(2),
  },
  h5: {
    fontFamily: "Neue Haas Grotesk Text 500",
    fontWeight: fontWeights.text.medium,
    // fontStyle: "normal",
    fontSize: pxToPt(18),
    lineHeight: pxToPt(22),
  },
  subtitle1: {
    fontFamily: "Neue Haas Grotesk Text 500",
    fontWeight: fontWeights.text.medium,
    // fontStyle: "normal",
    fontSize: pxToPt(16),
    lineHeight: pxToPt(20),
  },
  subtitle2: {
    fontFamily: "Neue Haas Grotesk Text 500",
    fontWeight: fontWeights.text.medium,
    // fontStyle: "normal",
    fontSize: pxToPt(14),
    lineHeight: pxToPt(18),
  },
  subtitle3: {
    fontFamily: "Neue Haas Grotesk Text 500",
    fontWeight: fontWeights.text.medium,
    // fontStyle: "normal",
    fontSize: pxToPt(12),
    lineHeight: pxToPt(16),
  },
  subtitle4: {
    fontFamily: "Neue Haas Grotesk Text 500",
    fontWeight: fontWeights.text.medium,
    // fontStyle: "normal",
    fontSize: pxToPt(10),
    lineHeight: pxToPt(14),
  },
  body1: {
    fontFamily: "Neue Haas Grotesk Text 400",
    fontWeight: fontWeights.text.roman,
    // fontStyle: "normal",
    fontSize: pxToPt(16),
    lineHeight: pxToPt(2),
  },
  body2: {
    fontFamily: "Neue Haas Grotesk Text 400",
    fontWeight: fontWeights.text.roman,
    // fontStyle: "normal",
    fontSize: pxToPt(14),
    lineHeight: pxToPt(18),
  },
  body3: {
    fontFamily: "Neue Haas Grotesk Text 400",
    fontWeight: fontWeights.text.roman,
    // fontStyle: "normal",
    fontSize: pxToPt(12),
    lineHeight: pxToPt(16),
  },
  body4: {
    fontFamily: "Neue Haas Grotesk Text 400",
    fontWeight: fontWeights.text.roman,
    // fontStyle: "normal",
    fontSize: pxToPt(10),
    lineHeight: pxToPt(14),
  },
  buttonLarge: {
    fontFamily: "Neue Haas Grotesk Text 500",
    fontWeight: fontWeights.text.medium,
    // fontStyle: "normal",
    fontSize: pxToPt(16),
    lineHeight: pxToPt(20),
  },
  button: {
    fontFamily: "Neue Haas Grotesk Text 500",
    fontWeight: fontWeights.text.medium,
    // fontStyle: "normal",
    fontSize: pxToPt(14),
    lineHeight: pxToPt(18),
    textTransform: "none",
  },
  buttonSmall: {
    fontFamily: "Neue Haas Grotesk Text 500",
    fontWeight: fontWeights.text.medium,
    // fontStyle: "normal",
    fontSize: pxToPt(12),
    lineHeight: pxToPt(16),
  },
}

type RouteContext = {
  params: { certificateType: string; uuid: string }
}

const OpenLearningLogo = () => {
  return (
    <Svg
      viewBox="0 0 260 67"
      fill="none"
      style={{
        width: pxToPt(260),
        height: pxToPt(67),
        position: "absolute",
        top: pxToPt(46),
        left: pxToPt(46),
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
      {/* <Defs>
        <clipPath id="clip0_22738_68399">
          <Rect width="260" height="67" fill="white" />
        </clipPath>
      </Defs> */}
    </Svg>
  )
}

const Badge = ({ displayType }: { displayType: string }) => {
  return (
    <View
      style={{
        position: "absolute",
        top: pxToPt(0),
        right: pxToPt(67),
      }}
    >
      <Svg
        viewBox="0 0 230 391"
        fill="none"
        style={{
          width: pxToPt(230),
          height: pxToPt(391),
        }}
      >
        <Path
          d="M183.001 391L114.501 349.587L46.0015 391V0H183.001V391Z"
          fill="#DDE1E6"
        />
        <Path
          d="M230.001 198.963C230.001 211.203 221.176 221.735 217.476 232.552C214.06 243.938 214.914 257.886 208.082 267.28C201.251 276.673 188.156 280.089 178.763 286.921C169.369 293.752 162.253 305.708 151.152 309.408C140.335 313.109 127.525 307.701 115.855 307.701C103.899 307.701 91.0897 313.109 80.5575 309.408C69.1714 305.708 62.055 293.752 52.9461 286.921C43.5525 280.089 30.1739 276.673 23.3422 267.28C16.5105 257.886 17.6491 243.938 13.9486 232.552C10.5328 221.735 1.42383 211.203 1.42383 198.963C1.42383 186.723 10.5328 176.191 13.9486 165.374C17.6491 153.988 16.5105 140.04 23.3422 130.646C30.1739 121.253 43.5525 117.837 52.9461 111.005C62.055 104.173 69.1714 92.2178 80.5575 88.5173C91.0897 84.8168 103.899 90.2253 115.855 90.2253C127.525 90.2253 140.335 84.8168 151.152 88.5173C162.253 92.2178 169.369 104.173 178.763 111.005C188.156 117.837 201.251 121.253 208.082 130.646C214.914 140.04 214.06 153.988 217.476 165.374C221.176 176.191 230.001 186.723 230.001 198.963Z"
          fill="#750014"
        />
        <Path
          d="M228.578 200.102C228.578 212.057 219.753 222.589 216.053 233.406C212.352 244.507 213.491 258.171 206.659 267.28C199.828 276.673 186.449 280.089 177.34 286.921C167.947 293.468 160.83 305.139 149.729 308.839C138.912 312.255 126.102 307.131 114.147 307.131C102.476 307.131 89.6668 312.255 78.85 308.839C67.7485 305.139 60.6321 293.468 51.2386 286.921C41.845 280.089 28.751 276.673 21.9193 267.28C15.0876 258.171 15.9416 244.507 12.5258 233.406C8.8253 222.589 0.000976562 212.057 0.000976562 200.102C0.000976562 188.146 8.8253 177.899 12.5258 167.082C15.9416 155.98 15.0876 142.317 21.9193 132.923C28.751 123.814 41.845 120.399 51.2386 113.567C60.6321 106.735 67.7485 95.0644 78.85 91.6486C89.6668 87.9481 102.476 93.0718 114.147 93.0718C126.102 93.0718 138.912 87.9481 149.729 91.6486C160.83 95.0644 167.947 106.735 177.34 113.567C186.449 120.399 199.828 123.814 206.659 132.923C213.491 142.317 212.352 155.98 216.053 167.082C219.753 177.899 228.578 188.146 228.578 200.102Z"
          fill="#750014"
        />
        <Path
          d="M200.967 197.255C200.967 246.785 160.547 287.206 111.017 287.206C61.4871 287.206 21.0664 246.785 21.0664 197.255C21.0664 147.725 61.4871 107.305 111.017 107.305C160.547 107.305 200.967 147.725 200.967 197.255Z"
          fill="#212326"
          fillOpacity="0.2"
        />
        <Path
          d="M205.806 203.233C205.806 252.763 165.67 292.899 116.14 292.899C66.3256 292.899 26.1895 252.763 26.1895 203.233C26.1895 153.419 66.3256 113.283 116.14 113.283C165.67 113.283 205.806 153.419 205.806 203.233Z"
          fill="#212326"
          fillOpacity="0.2"
        />
        <Path
          d="M204.098 200.387C204.098 250.201 163.962 290.337 114.147 290.337C64.6176 290.337 24.4814 250.201 24.4814 200.387C24.4814 150.857 64.6176 110.721 114.147 110.721C163.962 110.721 204.098 150.857 204.098 200.387Z"
          fill="#83192A"
        />
      </Svg>
      <Text
        style={{
          color: colors.white,
          position: "absolute",
          top: pxToPt(169),
          right: pxToPt(26),
          width: pxToPt(175),
          textAlign: "center",
          ...theme.h4,
          fontFamily: "Neue Haas Grotesk Text 700",
        }}
      >
        {displayType}
      </Text>
    </View>
  )
}

enum CertificateType {
  Course = "course",
  Program = "program",
}

const courseCertData = null
const programCertData = {
  user: {
    id: 2,
    username: "admin",
    name: "Test Admin",
    created_on: "2025-07-21T20:43:59.722355Z",
    updated_on: "2025-08-21T14:02:34.802327Z",
  },
  uuid: "603d5d51-7b16-4f4c-9083-33ae02868d39",
  is_revoked: false,
  certificate_page: {
    id: 39,
    meta: {
      type: "cms.CertificatePage",
      detail_url: "/api/v2/pages/39/",
      html_url:
        "http://localhost/programs/foundational-ai-modules/certificate-38/",
      slug: "certificate-38",
      show_in_menus: false,
      seo_title: "",
      search_description: "",
      first_published_at: "2025-08-05T19:41:27.373303Z",
      alias_of: null,
      locale: "en",
      live: true,
      last_published_at: null,
    },
    title: "Certificate For Foundational AI Modules",
    product_name: "Foundational AI Modules",
    CEUs: null,
    overrides: [],
    signatory_items: [
      {
        name: "Chris Capozzola",
        title_1: "Senior Associate Dean for Open Learning",
        title_2: "Professor of History",
        organization: "Massachusetts Institute of Technology",
        signature_image:
          "https://ol-mitxonline-app-qa.s3.amazonaws.com/original_images/Dimitris_Bertsimas_Signature.original.png",
      },
      {
        name: "Dimitris Bertsimas",
        title_1: "Vice Provost for Open Learning",
        organization: "Massachusetts Institute of Technology",
        signature_image:
          "https://ol-mitxonline-app-qa.s3.amazonaws.com/original_images/Dimitris_Bertsimas_Signature.original.png",
      },
      {
        name: "Dimitris Bertsimas",
        title_1: "Vice Provost for Open Learning",
        organization: "Massachusetts Institute of Technology",
        signature_image:
          "https://ol-mitxonline-app-qa.s3.amazonaws.com/original_images/Dimitris_Bertsimas_Signature.original.png",
      },
    ],
  },
  program: {
    title: "Foundational AI Modules",
    readable_id: "foundational-ai-modules",
    id: 2,
    courses: [16, 17],
    collections: [],
    requirements: {
      courses: {
        required: [16, 17],
        electives: [],
      },
      programs: {
        required: [],
        electives: [],
      },
    },
    start_date: "2024-01-01",
    end_date: "2025-01-01",
    req_tree: [
      {
        data: {
          node_type: "program_root",
          operator: null,
          operator_value: null,
          program: 2,
          course: null,
          required_program: null,
          title: "",
          elective_flag: false,
        },
        id: 2,
        children: [
          {
            data: {
              node_type: "operator",
              operator: "all_of",
              operator_value: null,
              program: 2,
              course: null,
              required_program: null,
              title: "Required Courses",
              elective_flag: false,
            },
            id: 3,
            children: [
              {
                data: {
                  node_type: "course",
                  operator: null,
                  operator_value: null,
                  program: 2,
                  course: 16,
                  required_program: null,
                  title: null,
                  elective_flag: false,
                },
                id: 4,
              },
              {
                data: {
                  node_type: "course",
                  operator: null,
                  operator_value: null,
                  program: 2,
                  course: 17,
                  required_program: null,
                  title: null,
                  elective_flag: false,
                },
                id: 5,
              },
            ],
          },
          {
            data: {
              node_type: "operator",
              operator: "all_of",
              operator_value: null,
              program: 2,
              course: null,
              required_program: null,
              title: "Elective Courses",
              elective_flag: true,
            },
            id: 6,
          },
        ],
      },
    ],
    page: {
      feature_image_src: "/static/images/mit-dome.png",
      page_url: "/programs/foundational-ai-modules/",
      financial_assistance_form_url: "",
      description:
        '<p data-block-key="206az">Earn a <b>Module Certificate</b> for each completed Foundational AI module.</p><p data-block-key="8i6rd">Complete all modules to receive a <b>Series Certificate</b>.</p>',
      live: true,
      length: "4 weeks",
      effort: null,
      price: "Zero Dollars",
    },
    program_type: "Series",
    certificate_type: "Certificate of Completion",
    departments: [
      {
        name: "UAI",
      },
    ],
    live: true,
    topics: [],
    availability: "anytime",
    enrollment_start: null,
    enrollment_end: null,
    required_prerequisites: false,
    duration: "4 weeks",
    min_weeks: null,
    max_weeks: null,
    time_commitment: null,
    min_weekly_hours: "4",
    max_weekly_hours: "4",
  },
  certificate_page_revision: 26,
}

// Define styles (similar to CSS-in-JS)
const styles = StyleSheet.create({
  page: {
    flexDirection: "column",
    backgroundColor: "#fff",
    padding: "27pt",
  },

  signatories: {
    display: "flex",
    flexDirection: "row",
    gap: "16px",
    position: "absolute",
    left: pxToPt(46),
    top: pxToPt(600),
    right: pxToPt(46),
  },

  signatory: {
    flex: "1 1 0",
    minWidth: 0,
  },

  signature: {
    width: "100px",
    height: "40px",
  },
})

// Grid component with green square markers every 100pt
const Grid = () => {
  // A4 landscape dimensions in points: 842 x 595
  const pageWidth = 842
  const pageHeight = 595
  const gridSpacing = 50 // 100pt spacing
  const markerSize = 4 // Size of the green squares

  const verticalLines = []
  const horizontalLines = []
  const markers = []

  // Create vertical grid lines and markers
  for (let x = 0; x <= pageWidth; x += gridSpacing) {
    // Add vertical line
    verticalLines.push(
      <Rect
        key={`v-${x}`}
        x={x}
        y={0}
        width={0.5}
        height={pageHeight}
        fill="rgba(0, 173, 0, 0.3)"
      />,
    )
  }

  // Create horizontal grid lines
  for (let y = 0; y <= pageHeight; y += gridSpacing) {
    horizontalLines.push(
      <Rect
        key={`h-${y}`}
        x={0}
        y={y}
        width={pageWidth}
        height={0.5}
        fill="rgba(0, 173, 0, 0.3)"
      />,
    )
  }

  return (
    <View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        zIndex: 2000,
      }}
    >
      <Svg
        viewBox={`0 0 ${pageWidth} ${pageHeight}`}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          zIndex: 9999,
        }}
      >
        {verticalLines}
        {horizontalLines}
      </Svg>
    </View>
  )
}

// React component for the PDF
function CertificateDoc({
  certificateType,
  uuid,
}: {
  certificateType: string
  uuid: string
}) {
  const title =
    certificateType === CertificateType.Course
      ? courseCertData?.course_run?.course?.title
      : programCertData?.program?.title

  const displayType =
    certificateType === CertificateType.Course
      ? "Module Certificate"
      : `${programCertData?.program?.program_type} Certificate`

  const userName =
    certificateType === CertificateType.Course
      ? courseCertData?.user?.name
      : programCertData?.user?.name

  const shortDisplayType =
    certificateType === CertificateType.Course
      ? "module"
      : programCertData?.program?.program_type === "Series"
        ? "series"
        : `${programCertData?.program?.program_type} program`

  const ceus =
    certificateType === CertificateType.Course
      ? null
      : programCertData?.certificate_page?.CEUs

  const signatories =
    certificateType === CertificateType.Course
      ? courseCertData?.certificate_page?.signatory_items
      : programCertData?.certificate_page?.signatory_items

  const startDate =
    certificateType === CertificateType.Course
      ? courseCertData?.course_run?.start_date
      : programCertData?.program?.start_date

  const endDate =
    certificateType === CertificateType.Course
      ? courseCertData?.course_run?.end_date
      : programCertData?.program?.end_date

  return (
    <Document
      title={`${title} Certificate - MIT Open Learning.pdf`}
      author="MIT Open Learning"
      pageLayout="singlePage"
    >
      <Page
        size="A4"
        orientation="landscape"
        dpi={72}
        // debug
        style={styles.page}
      >
        <View
          style={{
            width: "100%",
            height: "100%",
            border: `${pxToPt(4)} solid ${colors.silverGray}`,
            padding: pxToPt(24),
            backgroundColor: colors.white,
            fontFamily: "Neue Haas Grotesk Text 400",
            // marginTop: "50px",
            // margin: "0 auto",
          }}
        >
          <View
            style={{
              border: `1px solid ${colors.silverGrayLight}`,
              display: "flex",
              flexDirection: "column",
              position: "relative",
              height: "100%",
              gap: "52px",
              padding: "46px",
            }}
          >
            {/* <View
              style={{ width: "72pt", height: "72pt", backgroundColor: "red" }}
            />
            <View
              style={{ width: "96pt", height: "96pt", backgroundColor: "blue" }}
            /> */}
            <OpenLearningLogo />
            <Badge displayType={displayType} />

            <Text
              style={{
                color: colors.silverGrayDark,
                position: "absolute",
                top: pxToPt(164),
                left: pxToPt(46),

                ...theme.h4,
                fontFamily: "Neue Haas Grotesk Text 400",
              }}
            >
              This is to certify that
            </Text>
            <Text
              style={{
                color: colors.red,
                ...theme.h1,
                position: "absolute",
                top: pxToPt(206),
                left: pxToPt(46),
              }}
            >
              {userName}
            </Text>
            <Text
              style={{
                position: "absolute",
                top: pxToPt(286),
                left: pxToPt(46),
                // width: pxToPt(600),
                color: colors.silverGrayDark,
                ...theme.h4,
                fontSize: pxToPt(20),
                fontFamily: "Neue Haas Grotesk Text 400",
              }}
            >
              has successfully completed all requirements of the{" "}
              <Text
                style={{
                  fontFamily: "Neue Haas Grotesk Text 700",
                  // fontWeight: fontWeights.text.bold,
                  // fontSize: 20,
                  // lineHeight: 26,
                  // color: colors.silverGrayDark,
                }}
              >
                Universal Artificial Intelligence
              </Text>{" "}
              {shortDisplayType}:
            </Text>
            <Text
              style={{
                position: "absolute",
                top: pxToPt(396),
                left: pxToPt(46),
                ...theme.h2,
                fontFamily: "Neue Haas Grotesk Text 700",
                color: colors.black,
              }}
            >
              {title}
            </Text>
            {startDate && endDate && (
              <Text
                style={{
                  position: "absolute",
                  top: pxToPt(456),
                  left: pxToPt(46),
                  color: colors.silverGrayDark,
                  ...theme.h4,
                  fontFamily: "Neue Haas Grotesk Text 400",
                }}
              >
                {formatDate(startDate)} - {formatDate(endDate)}
              </Text>
            )}
            <Text
              style={{
                position: "absolute",
                top: pxToPt(506),
                left: pxToPt(46),
                color: colors.silverGrayDark,
                ...theme.h4,
                fontFamily: "Neue Haas Grotesk Text 400",
              }}
            >
              TODO Awarded 8 Continuing Education Units (CEUs)
            </Text>
            <View style={styles.signatories}>
              {signatories?.map((signatory, index) => (
                <View key={index} style={styles.signatory}>
                  <Image
                    source={
                      signatory.signature_image.startsWith("http")
                        ? signatory.signature_image
                        : `${process.env.NEXT_PUBLIC_MITX_ONLINE_BASE_URL}${signatory.signature_image}`
                    }
                    style={styles.signature}
                    // debug
                  />
                  <Text
                    style={{
                      ...theme.body1,
                      color: colors.silverGrayDark,
                    }}
                  >
                    {signatory.name}
                  </Text>{" "}
                  {signatory.title_1 && (
                    <Text
                      style={{
                        ...theme.body1,
                        color: colors.silverGrayDark,
                      }}
                    >
                      {signatory.title_1}
                    </Text>
                  )}
                  {signatory.title_2 && (
                    <Text
                      style={{
                        ...theme.body1,
                        color: colors.silverGrayDark,
                      }}
                    >
                      {signatory.title_2}
                    </Text>
                  )}
                  {signatory.organization && (
                    <Text
                      style={{
                        ...theme.body1,
                        color: colors.silverGrayDark,
                        paddingTop: pxToPt(8),
                      }}
                    >
                      {signatory.organization}
                    </Text>
                  )}
                </View>
              ))}
            </View>
            <Text
              style={{
                ...theme.body1,
                color: colors.silverGrayDark,
                position: "absolute",
                bottom: pxToPt(46),
                left: pxToPt(46),
              }}
            >
              <Text style={{ color: colors.black }}>Valid Certificate ID:</Text>{" "}
              {uuid}
            </Text>
          </View>
          <Grid />
        </View>
      </Page>
    </Document>
  )
}

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const { certificateType, uuid } = await ctx.params
  const pdfDoc = pdf(
    <CertificateDoc certificateType={certificateType} uuid={uuid} />,
  )

  const pdfStream = await pdfDoc.toBuffer()

  return new Response(pdfStream as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="certificate-${uuid}.pdf"`,
    },
  })
}
