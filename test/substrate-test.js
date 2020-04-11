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

describe('Lorena Substrate Tests', function () {
  let substrate
  let did, kZpair, pubKey
  const diddocHash = 'AQwafuaFswefuhsfAFAgsw'

  before('Lorena Substrate Test Preparation', async () => {
    did = await zenroom.randomDID()
    kZpair = await zenroom.newKeyPair(did)
    pubKey = kZpair[did].keypair.public_key
    substrate = new LorenaSubstrate(process.env.SERVER_SUBSTRATE)
  })

  it('Open a Seed', async () => {
    // SetKeyring and Connect are being called here because mocha Before function is not waiting for Keyring WASM library load
    await substrate.connect()
    const addr = substrate.setKeyring('subject grief save master kangaroo core ocean brick artwork admit main angle')
    expect(addr).equal('5CtW3TkcQq4z4fEmRBsu2GQdBSE6ve38ESeysaiQNE2GUWaE')
  })

  it('Register a DID', async () => {
    substrate.setKeyring('Alice')
    await substrate.registerDid(did, pubKey)
  })

  it('Check DID registration', async () => {
    const subs = await subscribe2RegisterEvents(substrate.api, 'DidRegistered')
    const registeredDid = JSON.parse(subs)
    const identity = await substrate.api.query.lorenaModule.identities(Utils.base64ToHex(did))
    const identityJson = JSON.parse(identity)
    // Identity `owner` should be address Alice
    expect(identityJson.owner).to.equal(substrate.keypair.address)
    expect(registeredDid[0]).to.equal(substrate.keypair.address)
    // Identity `key_index` should be 1
    expect(identityJson.key_index).to.equal(1)

    const key = await substrate.getActualDidKey(did)
    // Key `key` should be the same as the one read from Substrate Events
    expect(key).to.equal(pubKey)
    // Key `key` should de zenroom publicKey converted from bytes to utf8
    expect(Utils.hexToBase64(registeredDid[2].split('x')[1])).to.equal(pubKey)

    const theIdentity = await substrate.getActualIdentity(did)
    expect(theIdentity.valid_from.isEmpty).to.be.false
    expect(theIdentity.valid_to.isEmpty).to.be.true

    const doc = await substrate.getDidDocHash(did)
    expect(doc).to.be.empty
  })

  it('Register a Did Document', async () => {
    await substrate.registerDidDocument(did, diddocHash)
  })

  it('Check registration event', async () => {
    const subs = await subscribe2RegisterEvents(substrate.api, 'DidDocumentRegistered')
    const registeredDidDocument = JSON.parse(subs)
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
