import React from "react"
import { PlatformEnum, OfferedByEnum } from "api"
import Image from "next/image"

type WithImage = {
  name: string
  image: string
  aspect: number
}

type WithoutImage = {
  name: string
  image?: null
}

type LogoObject = WithImage | WithoutImage

export const UNIT_LOGOS: Record<OfferedByEnum, LogoObject> = {
  [OfferedByEnum.Mitx]: {
    name: "MITx Online",
    image: "/images/unit_logos/mitx.svg",
    aspect: 3.32,
  },
  [OfferedByEnum.Ocw]: {
    name: "MIT OpenCourseWare",
    image: "/images/unit_logos/ocw.svg",
    aspect: 6.03,
  },
  [OfferedByEnum.Bootcamps]: {
    name: "Bootcamps",
    image: "/images/platform_logos/bootcamps.svg",
    aspect: 5.25,
  },
  [OfferedByEnum.Xpro]: {
    name: "MIT xPRO",
    image: "/images/unit_logos/xpro.svg",
    aspect: 3.56,
  },
  [OfferedByEnum.Mitpe]: {
    name: "MIT Professional Education",
    image: "/images/unit_logos/mitpe.svg",
    aspect: 5.23,
  },
  [OfferedByEnum.See]: {
    name: "MIT Sloan Executive Education",
    image: "/images/unit_logos/see.svg",
    aspect: 7.61,
  },
}

// @ts-expect-error Local openapi client https://www.npmjs.com/package/@mitodl/open-api-axios
// out of sync while we adding an enum value.
export const PLATFORM_LOGOS: Record<PlatformEnum, LogoObject> = {
  [PlatformEnum.Ocw]: UNIT_LOGOS[OfferedByEnum.Ocw],
  [PlatformEnum.Edx]: {
    name: "edX",
    image: "/images/platform_logos/edx.svg",
    aspect: 1.77,
  },
  [PlatformEnum.Mitxonline]: UNIT_LOGOS[OfferedByEnum.Mitx],
  [PlatformEnum.Bootcamps]: UNIT_LOGOS[OfferedByEnum.Bootcamps],
  [PlatformEnum.Xpro]: UNIT_LOGOS[OfferedByEnum.Xpro],
  [PlatformEnum.Podcast]: {
    name: "Podcast",
  },
  [PlatformEnum.Csail]: {
    name: "CSAIL",
    image: "/images/platform_logos/csail.svg",
    aspect: 1.76,
  },
  [PlatformEnum.Mitpe]: UNIT_LOGOS[OfferedByEnum.Mitpe],
  [PlatformEnum.See]: UNIT_LOGOS[OfferedByEnum.See],
  [PlatformEnum.Scc]: {
    name: "Schwarzman College of Computing",
  },
  [PlatformEnum.Ctl]: {
    name: "Center for Transportation & Logistics",
  },
  [PlatformEnum.Emeritus]: {
    name: "Emeritus",
  },
  [PlatformEnum.Simplilearn]: {
    name: "Simplilearn",
  },
  [PlatformEnum.Globalalumni]: {
    name: "Global Alumni",
  },
  [PlatformEnum.Susskind]: {
    name: "Susskind",
  },
  [PlatformEnum.Whu]: {
    name: "WHU",
  },
  [PlatformEnum.Oll]: {
    name: "Open Learning Library",
    image: "/images/platform_logos/oll.svg",
    aspect: 5.25,
  },
  [PlatformEnum.Youtube]: {
    name: "YouTube",
  },
}

const DEFAULT_WIDTH = 200

const Logo: React.FC<{
  name: string
  image: string
  aspect: number
  className?: string
  width?: number
  height?: number
}> = ({ name, image, aspect, className, width, height }) => {
  if (!image) {
    return null
  }

  /* The Next.js Image component's requirement to specify both width and height are peculiar
   * in the context of SVG images that do not optimize. Likely to ensure no layout shift,
   * though for such a hard error ("Image is missing required width property"), the layout
   * doesn't necessarily shift, depending on the image placement and can be prevented with CSS.
   * The @next/next/no-img-element lint rule does not have any escape for SVGs despite the warning
   * not actually applying - "Using `<img>` could result in slower LCP and higher bandwidth.".
   */
  if (width && !height) {
    height = width / aspect
  }
  if (!width && height) {
    width = height * aspect
  }
  if (!width) {
    width = DEFAULT_WIDTH
    height = width / aspect
  }

  return (
    <Image
      src={image}
      className={className}
      alt={name}
      width={width}
      height={height}
    />
  )
}

export const UnitLogo: React.FC<{
  unitCode: OfferedByEnum
  className?: string
  width?: number
  height?: number
}> = ({ unitCode, className, width, height }) => {
  const unit = UNIT_LOGOS[unitCode]
  if (!unit?.image) return null
  const { name, image, aspect } = unit
  return (
    <Logo
      name={name}
      image={image}
      aspect={aspect}
      className={className}
      width={width}
      height={height}
    />
  )
}

export const PlatformLogo: React.FC<{
  platformCode: PlatformEnum
  className?: string
  width?: number
  height?: number
}> = ({ platformCode, className, width, height }) => {
  const platform = PLATFORM_LOGOS[platformCode]
  if (!platform?.image) return null
  const { name, image, aspect } = platform
  return (
    <Logo
      name={name}
      image={image}
      aspect={aspect}
      className={className}
      width={width}
      height={height}
    />
  )
}
