/**
 * iOS PushKit (VoIP push) → CallKit, in native code.
 *
 * Why native: when a VoIP push arrives, iOS requires the app to report an
 * incoming call to CallKit before the PushKit handler returns — and will
 * terminate (and eventually stop waking) an app that doesn't. When the app was
 * killed, JavaScript isn't running yet at that point, so the report has to be
 * made here, in AppDelegate. JS picks the call up afterwards via callkeep
 * events (see src/calls/callkeep.ts).
 *
 * The server's VoIP payload (agent-api src/push/apns.ts) is flat strings:
 *   { kind: 'call', callId: <uuid>, conversationId, callerName, video: 'true'|'false', ... }
 * `callId` is a UUID and doubles as the CallKit call UUID.
 *
 * react-native-callkeep's own plugin already adds the `voip` background mode.
 *
 * This edits the SDK 57 Swift AppDelegate template (verified against
 * expo/template.tgz by scripts/check-voip-plugin.js). If the anchor line is not
 * found — a future template change — prebuild fails loudly instead of
 * producing an app that silently can't ring.
 */
const { withAppDelegate, withDangerousMod, IOSConfig } = require('expo/config-plugins')
const fs = require('fs')
const path = require('path')

const MARK = '// chatflow:voip-push'

const SWIFT_EXTENSION = `
${MARK}
// RNVoipPushNotificationManager sets the PKPushRegistry delegate to the app delegate.
extension AppDelegate: PKPushRegistryDelegate {
  public func pushRegistry(_ registry: PKPushRegistry, didUpdate pushCredentials: PKPushCredentials, for type: PKPushType) {
    RNVoipPushNotificationManager.didUpdate(pushCredentials, forType: type.rawValue)
  }

  public func pushRegistry(_ registry: PKPushRegistry, didInvalidatePushTokenFor type: PKPushType) {
    // The app re-registers its device on next launch; the server also drops
    // tokens APNs reports as invalid.
  }

  public func pushRegistry(
    _ registry: PKPushRegistry,
    didReceiveIncomingPushWith payload: PKPushPayload,
    for type: PKPushType,
    completion: @escaping () -> Void
  ) {
    let data = payload.dictionaryPayload
    let callId = (data["callId"] as? String) ?? UUID().uuidString
    let caller = (data["callerName"] as? String) ?? "Website visitor"
    let hasVideo = (data["video"] as? String) == "true"

    RNVoipPushNotificationManager.addCompletionHandler(callId, completionHandler: completion)
    RNVoipPushNotificationManager.didReceiveIncomingPush(with: payload, forType: type.rawValue)

    // Must happen before completion() — iOS's hard rule for VoIP pushes.
    RNCallKeep.reportNewIncomingCall(
      callId,
      handle: caller,
      handleType: "generic",
      hasVideo: hasVideo,
      localizedCallerName: caller,
      supportsHolding: false,
      supportsDTMF: false,
      supportsGrouping: false,
      supportsUngrouping: false,
      fromPushKit: true,
      payload: data as? [AnyHashable: Any],
      withCompletionHandler: nil
    )
    completion()
  }
}
`

/** Pure transform of the Swift bridging header. Idempotent. */
function patchBridgingHeader(src) {
  if (src.includes('RNVoipPushNotificationManager.h')) return src
  return `${src}\n#import "RNVoipPushNotificationManager.h"\n#import "RNCallKeep.h"\n`
}

/** Pure transform of AppDelegate.swift. Idempotent. */
function patchAppDelegate(src) {
  if (src.includes(MARK)) return src
  if (!/^import PushKit$/m.test(src)) src = src.replace(/^import React$/m, 'import React\nimport PushKit')

  const anchor = 'return super.application(application, didFinishLaunchingWithOptions: launchOptions)'
  if (!src.includes(anchor)) throw new Error('[withVoipPush] AppDelegate didFinishLaunching anchor not found')
  src = src.replace(anchor,
    `${MARK}\n    // Register for VoIP pushes as early as possible, before JS is up.\n    RNVoipPushNotificationManager.voipRegistration()\n\n    ${anchor}`)

  return src + SWIFT_EXTENSION
}

const withBridgingHeader = (config) =>
  withDangerousMod(config, ['ios', (cfg) => {
    const root = IOSConfig.Paths.getSourceRoot(cfg.modRequest.projectRoot)
    const name = fs.readdirSync(root).find((f) => f.endsWith('-Bridging-Header.h'))
    if (!name) throw new Error(`[withVoipPush] No Swift bridging header found in ${root}`)
    const header = path.join(root, name)
    fs.writeFileSync(header, patchBridgingHeader(fs.readFileSync(header, 'utf8')))
    return cfg
  }])

const withSwiftDelegate = (config) =>
  withAppDelegate(config, (cfg) => {
    if (cfg.modResults.language !== 'swift') {
      throw new Error('[withVoipPush] Expected a Swift AppDelegate (Expo SDK 57 template)')
    }
    cfg.modResults.contents = patchAppDelegate(cfg.modResults.contents)
    return cfg
  })

module.exports = function withVoipPush(config) {
  return withSwiftDelegate(withBridgingHeader(config))
}
module.exports.patchAppDelegate = patchAppDelegate
module.exports.patchBridgingHeader = patchBridgingHeader
