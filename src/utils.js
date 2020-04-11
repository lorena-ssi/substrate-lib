'use strict'

class Utils {
  static hexToBase64 (str) {
    return Buffer.from(str, 'hex').toString('utf8')
  }

  static base64ToHex (str) {
    var hex; var result = ''
    for (var i = 0; i < str.length; i++) {
      hex = str.charCodeAt(i).toString(16)
      result = result + hex.toString()
    }

    return result
  }

  static toUTF8Array (str) {
    var utf8 = []
    for (var i = 0; i < str.length; i++) {
      var charcode = str.charCodeAt(i)
      if (charcode < 0x80) utf8.push(charcode)
      else if (charcode < 0x800) {
        utf8.push(0xc0 | (charcode >> 6),
          0x80 | (charcode & 0x3f))
      } else if (charcode < 0xd800 || charcode >= 0xe000) {
        utf8.push(0xe0 | (charcode >> 12),
          0x80 | ((charcode >> 6) & 0x3f),
          0x80 | (charcode & 0x3f))
      } else {
        // surrogate pair
        i++
        // UTF-16 encodes 0x10000-0x10FFFF by
        // subtracting 0x10000 and splitting the
        // 20 bits of 0x0-0xFFFFF into two halves
        charcode = (((charcode & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff)) + 0x010000
        utf8.push(0xf0 | (charcode >> 18),
          0x80 | ((charcode >> 12) & 0x3f),
          0x80 | ((charcode >> 6) & 0x3f),
          0x80 | (charcode & 0x3f))
      }
    }
    return utf8
  }
}

module.exports = Utils
