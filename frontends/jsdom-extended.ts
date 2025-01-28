// Jest environment extended with Web APIs para tranbajar con MSW
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
