/**
 * For some reason Jest's JSDOM environment does not include these, though they
 * have been available in NodeJS and web browsers for a while now.
 */
import { TestEnvironment } from "jest-environment-jsdom"
import { EnvironmentContext, JestEnvironmentConfig } from "@jest/environment"

class JSDOMEnvironmentExtended extends TestEnvironment {
  constructor(config: JestEnvironmentConfig, context: EnvironmentContext) {
    super(config, context)

    this.global.TransformStream = TransformStream
    this.global.ReadableStream = ReadableStream
    this.global.Response = Response
    this.global.TextDecoderStream = TextDecoderStream
  }
}

export default JSDOMEnvironmentExtended
