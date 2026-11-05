// Run from the repo root: node backend/scripts/waWidgetQr.check.cjs
// Compares (in byte mode, which is all the widget uses) the QR generator inside public/wa-widget.js with the `qrcode` library, module by module.
const fs = require('fs'), assert = require('assert'), QRCode = require('qrcode')
const src = fs.readFileSync('public/wa-widget.js', 'utf8')
const body = src.slice(src.indexOf('/* QR:start'), src.indexOf('/* QR:end */'))
const qrEncode = new Function(body + '; return qrEncode')()

const samples = [
  'https://wa.me/919876543210',
  'https://wa.me/919876543210?text=Hi%2C%20I%20have%20a%20question',
  'https://wa.me/message/RLCP76WN676EO1',
  'https://wa.me/447911123456?text=' + encodeURIComponent('Héllo wörld — pricing & plans? 👋 ' + 'x'.repeat(120)),   // multibyte + longer → higher version
  'https://wa.me/919876543210?text=' + encodeURIComponent('y'.repeat(200)),
]
let sameMask = 0
for (const text of samples) {
  const level = qrEncode(text).level                      // M, or L when the link is too long for M within version 10
  const ref = QRCode.create([{ data: text, mode: 'byte' }], { errorCorrectionLevel: level })
  const mine = qrEncode(text, ref.maskPattern)           // same mask → every module must match
  assert.equal(mine.size, ref.modules.size, 'size ' + text.slice(0, 30))
  for (let y = 0; y < mine.size; y++) for (let x = 0; x < mine.size; x++) {
    assert.equal(mine.modules[y][x], ref.modules.get(y, x) === 1, `module ${x},${y} of ${text.slice(0, 30)}`)
  }
  if (qrEncode(text).mask === ref.maskPattern) sameMask++
  console.log('ok  ' + mine.level + ' v' + mine.version + '  ' + mine.size + 'x' + mine.size + '  ' + text.slice(0, 48))
}
console.log(`mask chosen by the widget's own penalty scoring matched the library in ${sameMask}/${samples.length} samples`)
assert.equal(qrEncode('x'.repeat(400)), null)             // too long for versions 1–10: no QR rather than a wrong one
console.log('qr ok')
