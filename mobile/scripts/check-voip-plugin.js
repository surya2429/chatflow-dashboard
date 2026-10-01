/*
 * Checks plugins/withVoipPush.js against the AppDelegate.swift that THIS
 * installed Expo SDK actually generates — useful on Windows, where
 * `expo prebuild` can't produce the iOS project, and after any SDK upgrade.
 *
 *   node scripts/check-voip-plugin.js
 *
 * It verifies the transform finds its anchor, adds what CallKit/PushKit need,
 * and is idempotent. It cannot compile Swift; the first macOS build (or EAS
 * build) is still the real proof.
 */
const { execFileSync } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { patchAppDelegate, patchBridgingHeader } = require('../plugins/withVoipPush')

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'expo-template-'))
const tgz = require.resolve('expo/template.tgz')
try {
  // GNU tar (e.g. Git Bash) reads "C:\…" as host:path unless told otherwise.
  execFileSync('tar', ['--force-local', '-xzf', tgz, '-C', tmp], { stdio: 'ignore' })
} catch {
  execFileSync('tar', ['-xzf', tgz, '-C', tmp]) // bsdtar (macOS, Windows' tar.exe)
}
const iosDir = path.join(tmp, 'package', 'ios')
const appDir = fs.readdirSync(iosDir).map(d => path.join(iosDir, d)).find(d => fs.existsSync(path.join(d, 'AppDelegate.swift')))
if (!appDir) throw new Error('Template has no AppDelegate.swift — SDK layout changed')

const delegate = fs.readFileSync(path.join(appDir, 'AppDelegate.swift'), 'utf8')
const headerName = fs.readdirSync(appDir).find(f => f.endsWith('-Bridging-Header.h'))
const header = fs.readFileSync(path.join(appDir, headerName), 'utf8')

const out = patchAppDelegate(delegate)
const outHeader = patchBridgingHeader(header)
const checks = [
  ['imports PushKit', /^import PushKit$/m.test(out)],
  ['registers for VoIP at launch, before returning', /voipRegistration\(\)\s*\n\s*return super\.application\(application, didFinishLaunchingWithOptions/.test(out)],
  ['implements PKPushRegistryDelegate', out.includes('extension AppDelegate: PKPushRegistryDelegate')],
  ['reports to CallKit before completion()', out.indexOf('RNCallKeep.reportNewIncomingCall') < out.lastIndexOf('completion()')],
  ['AppDelegate transform is idempotent', patchAppDelegate(out) === out],
  ['bridging header imports both ObjC modules', outHeader.includes('RNVoipPushNotificationManager.h') && outHeader.includes('RNCallKeep.h')],
  ['bridging header transform is idempotent', patchBridgingHeader(outHeader) === outHeader],
]
let failed = 0
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`)
  if (!ok) failed++
}
fs.rmSync(tmp, { recursive: true, force: true })
process.exit(failed ? 1 : 0)
