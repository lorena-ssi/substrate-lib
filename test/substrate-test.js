'use strict'
const chai = require('chai')
var chaiAsPromised = require('chai-as-promised')
chai.use(chaiAsPromised)
chai.should()
const expect = chai.expect
require('dotenv').config()
const Utils = require('../src/utils')
const LorenaSubstrate = require('../src/index.js')
const Zen = require('@lorena-ssi/zenroom-lib')
const zenroom = new Zen(true)

const subscribe2RegisterEvents = (api, eventMethod) => {
  return new Promise(resolve => {
    api.query.system.events(events => {
      events.forEach(record => {
        const { event /*, phase */ } = record
        const types = event.typeDef
        if (event.section === 'lorenaModule' && event.method === eventMethod) {
          for (let i = 0; i < event.data.length; i++) {
            // All events have a a type 'AccountId'
            if (types[i].type === 'AccountId') {
              resolve(event.data.toString())
            }
          }
          resolve([])
        }
      })
    })
  })
}

describe('Conversions', () => {
  it('should have good format conversion', () => {
    const base64 = 'Wldvd1pqVmZWbEoxYVdaWFdGOW5ja05I'
    const hex = '576c647664317071566d5a5762456f7859566461574664474f57356a61303549'
    const hexed = Utils.base64ToHex(base64)
    const based = Utils.hexToBase64(hex)
    expect(hexed).to.eq(hex)
    expect(based).to.eq(base64)
  })
})

describe('Lorena Substrate Tests', function () {
  let substrate
  let did, kZpair, pubKey
  let keyRegister
  const diddocHash = 'AQwafuaFswefuhsfAFAgsw'

  before('Lorena Substrate Test Preparation', async () => {
    did = await zenroom.randomDID()
    kZpair = await zenroom.newKeyPair(did)
    pubKey = kZpair[did].keypair.public_key
    substrate = new LorenaSubstrate(process.env.SERVER_SUBSTRATE)
  })

  it('should connect to Substrate', async () => {
    // SetKeyring and Connect are being called here because mocha Before function is not waiting for Keyring WASM library load
    await substrate.connect()
  })

  it('should use a SURI as a key', async () => {
    const alice = substrate.setKeyring('//Alice')
    expect(alice).eq('5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY')
  })

  xit('should send some dineros from Alice to Cooter', async () => {
  })

  xit('should set a real key for Cooter', async () => {
    const addr = substrate.setKeyring('vendor drip girl despair trash muscle violin december green dragon ordinary crop')
    expect(addr).equal('5H67ieFmTDNKspGpBKDJUrYQvGKDU9zvRR59azqL1cSo9rno')
  })

  it('Register a DID', async () => {
    await substrate.registerDid(did, pubKey)
  })

  it('Check DID registration', async () => {
    const subs = await subscribe2RegisterEvents(substrate.api, 'DidRegistered')
    const registeredDid = JSON.parse(subs)
    const identity = await substrate.api.query.lorenaModule.identities(Utils.base64ToHex(did))
    const identityJson = JSON.parse(identity)

    // Check of object `Identity` was created as expected
    // Identity `owner` should be address Alice
    expect(identityJson.owner).to.equal(substrate.keypair.address)
    // Identity `owner` from RegisteredEvent should be address Alice
    expect(registeredDid[0]).to.equal(substrate.keypair.address)
    // Identity `key_index` should be 1
    expect(identityJson.key_index).to.equal(1)

    // Check if object `Key` was created as expected
    keyRegister = await substrate.getActualKey(did)
    // Key `key` should be the same as the one read from Substrate Events
    expect(keyRegister.key.toString()).to.equal(registeredDid[2])
    // Key `key` should de zenroom publicKey converted from bytes to utf8
    expect(Utils.hexToBase64(keyRegister.key.toString().split('x')[1])).to.equal(pubKey)
    // Key `diddoc` should be Empty
    expect(keyRegister.diddoc.isEmpty).to.be.true
    // Key `valid_from` should be a valid timestamp (less than a minute ago)
    expect(keyRegister.valid_from.isEmpty).to.be.false
    // Key `valid_to` should be 0 representing an empty value
    expect(keyRegister.valid_to.isEmpty).to.be.true
  })

  it('Register a Did Document', async () => {
    await substrate.registerDidDocument(did, diddocHash)
  })

  it('Check registration event', async () => {
    const subs = await subscribe2RegisterEvents(substrate.api, 'DidDocumentRegistered')
    const registeredDidDocument = JSON.parse(subs)
    // Diddoc hash should change from empty to the matrix `mediaId` url represented by a `Vec<u8>`
    expect(Utils.hexToBase64(registeredDidDocument[2].split('x')[1])).to.eq(diddocHash)
  })

  it('Check a Did Document', async () => {
    const result = await substrate.getDidDocHash(did)
    expect(result).to.be.eq(diddocHash)
  })

  it('GetKey from a DID', async () => {
    const result = await substrate.getActualDidKey(did)
    expect(result).to.eq(pubKey)
  })

  it('Rotate Key', async () => {
    const newKeyPair = await zenroom.newKeyPair(did)
    const newPubKey = newKeyPair[did].keypair.public_key
    await substrate.rotateKey(did, newPubKey)
    const subs = await subscribe2RegisterEvents(substrate.api, 'KeyRotated')
    const keyRotated = JSON.parse(subs)
    expect(Utils.hexToBase64(keyRotated[2].split('x')[1])).to.eq(newPubKey)
    const key = await substrate.getActualDidKey(did)
    expect(key).equal(newPubKey)
  })

  it('should clean up after itself', () => {
    substrate.disconnect()
  })
})
