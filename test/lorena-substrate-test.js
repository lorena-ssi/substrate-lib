'use strict'
const chai = require('chai')
var chaiAsPromised = require('chai-as-promised')

chai.use(chaiAsPromised)
// Configure chai
chai.should()
const expect = chai.expect

require('dotenv').config()
const LorenaSubstrate = require('../src/lorena-substrate.js')
const Utils = require('../src/utils/utils')
const Zen = require('@caelum-tech/zenroom-lib')
const z = new Zen('sha256')

// 'caelumlabs' SHA256 hash
const caelumHashedDid = '42dd5715a308829e'

const generateDid = async (myString) => {
  const zhash = await z.hash(myString)
  console.log('zhash:', zhash)
  const did = zhash.hash.substr(0, 16)
  console.log('Did: ' + did)
  return did
}

const generatePublicKey = async (did) => {
  const kZpair = await z.newKeyPair(did)
  const pubKey = kZpair[did].keypair.public_key
  console.log('Public Key:', pubKey)
  return pubKey
}

const subscribe2Events = (api) => {
  return new Promise(resolve => {
    api.query.system.events(events => {
      if (!events) {
        return resolve('no events')
      }

      console.log(`[${Date.now()}] ${events.length}`)

      events.forEach(record => {
        const { event, phase } = record
        const types = event.typeDef

        console.log(`[${Date.now()}] ${event.section} ${event.method}`)

        if (event.section === 'lorenaModule' && event.method === 'DidRegistered') {
          console.log('Received DidRegistered event!')
          console.log(`[${Date.now()}] ${event.data.length}`)
          for (let i = 0; i < event.data.length; i++) {
            console.log(`[${Date.now()}] ${types[i].type}`)
            if (types[i].type === 'Hash') {
              console.log(`${types[i].type}: ${event.data[i]}`)
              return resolve(event.data[i].toString())
            }
          }
        }
      });
    });
  });
}

describe('Lorena Substrate Tests', function () {
  const subModule = new LorenaSubstrate()
  let did, pubKey

  before('Lorena Substrate Test Preparation', async() => {
    const didString = Utils.makeUniqueString(16)
    did = await generateDid(didString)
    pubKey = await generatePublicKey(did)
  })

  it('Generate a DID and publicKey', async () => {
    const didGenTest = await generateDid('caelumlabs')
    const pubKeyGenTest = await generatePublicKey(didGenTest)
    console.log('didGen: ' + didGenTest + ' pubkey: ' + pubKeyGenTest)
    expect(didGenTest).equal(caelumHashedDid)
  })

  it('Register a DID', (done) => {
    // SetKeyring and Connect are being called here because mocha Before function is not waiting fro Keyring WASM library load
    subModule.setKeyring('Alice')
    subModule.connect().then(() => {
      subModule.registerDid(did, pubKey, () => {
        console.log('Not done!!!!!')
      }).then((did) => {
        console.log('DIDDDD', did, pubKey)
        done()
      })
    })
  })

  it('Check DID registration', async () => {
    const registeredDid = await subscribe2Events(subModule.api)
    console.log('Registered DID:', registeredDid)
    const hexWithPadding = registeredDid.split('x')[1]
    const hex = hexWithPadding.substring(0, 16)
    // console.log('HEX', hex)
    console.log('UTF8', Buffer.from(hex, 'hex').toString('utf8'))
    expect(hex).equal(did)
  })

  it('GetKey from a DID', (done) => {
    subModule.getActualDidKey(did).then((key) => {
      console.log('Did: ' + did + ' Returned key@: ' + key)
      const hex = key.split('x')[1]
      // console.log('HEX', hex)
      console.log('UTF8', Buffer.from(hex, 'hex').toString('utf8'))
      expect(Buffer.from(hex, 'hex').toString('utf8')).equal(pubKey)
      done()
    })
  })

  // it('Register a Did Doc Hash', async () => {
  //   const randomHash = Utils.makeUniqueString.toString(16)
  //   await subModule.registerDidDocument(did, randomHash)
  //   console.log('Register a Did Doc Hash - Did:' + did + ' RandomHash:' + randomHash)
  //   await subModule.getDidDocHash(did) (result)
  //   console.log('getDidDocHash - Query - Hash', result)
  // })

  it('Rotate Key', (done) => {
    // const newPubKey = await generatePublicKey(did)
    subModule.rotateKey(did, pubKey).then(() => {
      subModule.getActualDidKey(did).then((key) => {
        // console.log('Did: ' + did + ' Returned key@: ' + key)
        const hex = key.split('x')[1]
        // console.log('HEX', hex)
        console.log('UTF8', Buffer.from(hex, 'hex').toString('utf8'), '==?', pubKey)
        expect(Buffer.from(hex, 'hex').toString('utf8')).equal(pubKey)
        done()
      })
    })
  })
})
