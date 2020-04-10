'use strict'
const chai = require('chai')
var chaiAsPromised = require('chai-as-promised')
chai.use(chaiAsPromised)
chai.should()
const expect = chai.expect

const util = require('util')
const sleep = util.promisify(setTimeout)

require('dotenv').config()
const Utils = require('../src/utils')
const LorenaSubstrate = require('../src/index.js')
const Zen = require('@lorena-ssi/zenroom-lib')
const zenroom = new Zen(true)

const filterEvents = (api, eventMethod) => {
  return new Promise(resolve => {
    api.query.system.events(events => {
      if (!events) {
        return resolve('no events')
      }
      events.forEach(record => {
        const { event /*, phase */ } = record

        const types = event.typeDef
        if (event.section === 'lorenaModule' && event.method === eventMethod) {
          // return resolve(event.data.toString())
          for (let i = 0; i < event.data.length; i++) {
            // All events have a a type 'AccountId'
            if (types[i].type === 'AccountId') {
              resolve(event.data.toString())
            }
            resolve([])
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
    // make sure we get the next block
    await sleep(5000)

    const registeredDid = JSON.parse(await filterEvents(substrate.api, 'DidRegistered'))
    const identity = JSON.parse(await substrate.api.query.lorenaModule.identities(Utils.stringToHash(did)))
    // Identity `owner` should be address Alice '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'
    expect(identity.owner).equal('5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY')
    // expect(registeredDid[0]).equal('5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY')
    // Identity `key_index` should be 1
    expect(identity.key_index).equal(1)

    const key = await substrate.getActualDidKey(did)
    // Key `key` should be the same as the one read from Substrate Events
    expect(key.key).equal(registeredDid[2])
    // TODO: Key `key` should de zenroom publicKey converted from  bytes to utf8

    // Key `diddoc` should be "0x"
    expect(key.diddoc).equal('0x')

    // Key `valid_from` should be an integer
    expect(key.valid_from).to.be.an('number')
    // Key `valid_to` should be 0
    expect(key.valid_to).equal(0)
  })

  it('Register a Did Document', async () => {
    const diddocHash = 'AQwafuaFswefuhsfAFAgsw'
    await substrate.registerDidDocument(did, diddocHash)
    const registeredDidDocument = await filterEvents(substrate.api, 'DidDocumentRegistered')
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
    await filterEvents(substrate.api, 'KeyRotated')
    const key = await substrate.getActualDidKey(did)
    expect(key).equal(newPubKey)
  })

  it('should clean up after itself', () => {
    substrate.disconnect()
  })
})
