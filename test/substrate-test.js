'use strict'
const chai = require('chai')
var chaiAsPromised = require('chai-as-promised')
chai.use(chaiAsPromised)
chai.should()
const expect = chai.expect

require('dotenv').config()
const LorenaSubstrate = require('../src/index.js')
const Zen = require('@lorena-ssi/zenroom-lib')
const zenroom = new Zen(true)

const subscribe2RegisterEvents = (api, eventMethod) => {
  return new Promise(resolve => {
    api.query.system.events(events => {
      if (!events) {
        return resolve('no events')
      }
      events.forEach(record => {
        const { event /*, phase */ } = record
        const types = event.typeDef
        if (event.section === 'lorenaModule' && event.method === eventMethod) {
          for (let i = 0; i < event.data.length; i++) {
            if (types[i].type === 'Hash' || types[i].type === 'Bytes') {
              return resolve(event.data[i].toString())
            }
          }
        }
      })
    })
  })
}

describe('Lorena Substrate Tests', function () {
  let substrate
  let did, kZpair, pubKey

  before('Lorena Substrate Test Preparation', async () => {
    did = await zenroom.randomDID()
    kZpair = await await zenroom.newKeyPair(did)
    pubKey = kZpair[did].keypair.public_key
    substrate = new LorenaSubstrate(process.env.SERVER_SUBSTRATE)
    await substrate.connect()
  })

  it('Open a Seed', async () => {
    const addr = substrate.setKeyring('subject grief save master kangaroo core ocean brick artwork admit main angle')
    expect(addr).equal('5HU145mGtqoAuVbporePWDVA4oaVyvRwaQcapJ3oaJGiRuC4')
  })

  it('Register a DID', async () => {
    // SetKeyring and Connect are being called here because mocha Before function is not waiting fro Keyring WASM library load
    substrate.setKeyring('Alice')
    await substrate.registerDid(did, kZpair[did].keypair.public_key)
  })

  it('Check DID registration', async () => {
    const registeredDid = await subscribe2RegisterEvents(substrate.api, 'DidRegistered')
    const events = await substrate.api.query.system.events()
    console.log(events)
    const hexWithPadding = registeredDid.split('x')[1]
    const hex = hexWithPadding.substring(0, 16)
    // expect(hex).equal(did)
  })

  it('Register a Did Document', async () => {
    const diddocHash = 'AQwafuaFswefuhsfAFAgsw'
    await substrate.registerDidDocument(did, diddocHash)
    const registeredDidDocument = await subscribe2RegisterEvents(substrate.api, 'DidDocumentRegistered')
    const events = await substrate.api.query.system.events()
    console.log(events)
    console.log(registeredDidDocument)
    // expect(registeredDidDocument).to.eq(diddocHash)
  })

  it('GetKey from a DID', async () => {
    substrate.getActualDidKey(did).then((key) => {
      expect(key).equal(pubKey)
    })
  })

  it('Rotate Key', async () => {
    const newKeyPair = await await zenroom.newKeyPair(did)
    const newPubKey = newKeyPair[did].keypair.public_key
    await substrate.rotateKey(did, newPubKey)
    await subscribe2RegisterEvents(substrate.api, 'KeyRotated')
    const key = await substrate.getActualDidKey(did)
    expect(key).equal(newPubKey)
  })

  it('should clean up after itself', () => {
    substrate.disconnect()
  })
})
