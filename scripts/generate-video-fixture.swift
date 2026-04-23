import AVFoundation
import CoreVideo
import CoreGraphics
import Foundation

enum FixtureError: Error {
  case missingArgument
  case cannotCreateWriter
  case cannotCreatePixelBuffer
  case appendFailed(Int)
  case writerFailed(String)
}

func makePixelBuffer(
  width: Int,
  height: Int,
  red: CGFloat,
  green: CGFloat,
  blue: CGFloat
) throws -> CVPixelBuffer {
  let attributes: [String: Any] = [
    kCVPixelBufferCGImageCompatibilityKey as String: true,
    kCVPixelBufferCGBitmapContextCompatibilityKey as String: true
  ]

  var maybeBuffer: CVPixelBuffer?
  let status = CVPixelBufferCreate(
    kCFAllocatorDefault,
    width,
    height,
    kCVPixelFormatType_32ARGB,
    attributes as CFDictionary,
    &maybeBuffer
  )

  guard status == kCVReturnSuccess, let pixelBuffer = maybeBuffer else {
    throw FixtureError.cannotCreatePixelBuffer
  }

  CVPixelBufferLockBaseAddress(pixelBuffer, [])
  defer { CVPixelBufferUnlockBaseAddress(pixelBuffer, []) }

  guard let baseAddress = CVPixelBufferGetBaseAddress(pixelBuffer) else {
    throw FixtureError.cannotCreatePixelBuffer
  }

  let bytesPerRow = CVPixelBufferGetBytesPerRow(pixelBuffer)
  let colorSpace = CGColorSpaceCreateDeviceRGB()
  guard let context = CGContext(
    data: baseAddress,
    width: width,
    height: height,
    bitsPerComponent: 8,
    bytesPerRow: bytesPerRow,
    space: colorSpace,
    bitmapInfo: CGImageAlphaInfo.noneSkipFirst.rawValue
  ) else {
    throw FixtureError.cannotCreatePixelBuffer
  }

  context.setFillColor(red: red, green: green, blue: blue, alpha: 1.0)
  context.fill(CGRect(x: 0, y: 0, width: width, height: height))
  return pixelBuffer
}

func main() throws {
  guard CommandLine.arguments.count >= 2 else {
    throw FixtureError.missingArgument
  }

  let outputURL = URL(fileURLWithPath: CommandLine.arguments[1])
  try? FileManager.default.removeItem(at: outputURL)

  let writer = try AVAssetWriter(outputURL: outputURL, fileType: .mp4)
  let width = 64
  let height = 64
  let framesPerSecond = 2
  let frameCount = 4

  let settings: [String: Any] = [
    AVVideoCodecKey: AVVideoCodecType.h264,
    AVVideoWidthKey: width,
    AVVideoHeightKey: height
  ]

  let input = AVAssetWriterInput(mediaType: .video, outputSettings: settings)
  input.expectsMediaDataInRealTime = false

  let adaptor = AVAssetWriterInputPixelBufferAdaptor(
    assetWriterInput: input,
    sourcePixelBufferAttributes: [
      kCVPixelBufferPixelFormatTypeKey as String: Int(kCVPixelFormatType_32ARGB),
      kCVPixelBufferWidthKey as String: width,
      kCVPixelBufferHeightKey as String: height
    ]
  )

  guard writer.canAdd(input) else {
    throw FixtureError.cannotCreateWriter
  }

  writer.add(input)
  writer.startWriting()
  writer.startSession(atSourceTime: .zero)

  let colors: [(CGFloat, CGFloat, CGFloat)] = [
    (1.0, 0.2, 0.2),
    (0.2, 1.0, 0.2),
    (0.2, 0.2, 1.0),
    (1.0, 0.8, 0.2)
  ]

  for frameIndex in 0..<frameCount {
    while !input.isReadyForMoreMediaData {
      usleep(1_000)
    }

    let color = colors[frameIndex % colors.count]
    let pixelBuffer = try makePixelBuffer(
      width: width,
      height: height,
      red: color.0,
      green: color.1,
      blue: color.2
    )

    let presentationTime = CMTime(value: Int64(frameIndex), timescale: Int32(framesPerSecond))
    if !adaptor.append(pixelBuffer, withPresentationTime: presentationTime) {
      throw FixtureError.appendFailed(frameIndex)
    }
  }

  input.markAsFinished()

  let semaphore = DispatchSemaphore(value: 0)
  writer.finishWriting {
    semaphore.signal()
  }
  semaphore.wait()

  if writer.status != .completed {
    throw FixtureError.writerFailed(writer.error?.localizedDescription ?? "unknown error")
  }
}

do {
  try main()
} catch {
  fputs("generate-video-fixture.swift error: \(error)\n", stderr)
  exit(1)
}
