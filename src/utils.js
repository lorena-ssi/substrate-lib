'use strict'

class Utils {
  static hexToBase64 (str) {
    return Buffer.from(str, 'hex').toString('utf8')
  }

  static base64ToHex (str) {
    return Buffer.from(str, 'utf8').toString('hex')
  }

  static toUTF8Array (str) {
    const buffer = Buffer.from(str, 'utf8')
    return Array.prototype.slice.call(buffer, 0)
  }
}

module.exports = Utils
