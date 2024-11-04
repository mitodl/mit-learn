export type ImageConfig = {
  width: number
  height: number
}

const imgConfigs = {
  row: {
    width: 170,
    height: 130,
  },
  "row-reverse": {
    width: 170,
    height: 130,
  },
  "row-reverse-small": {
    width: 160,
    height: 100,
  },
  column: {
    width: 302,
    height: 182,
  },
  large: {
    width: 385,
    height: 200,
  },
} satisfies Record<string, ImageConfig>

export { imgConfigs }
