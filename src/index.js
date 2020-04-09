/* eslint-disable no-async-promise-executor */
'use strict'

// Debug
var debug = require('debug')('did:debug:sub')

const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api')
const { TypeRegistry } = require('@polkadot/types')
const { Vec } = require('@polkadot/types/codec')
const Utils = require('./utils')
const { cryptoWaitReady } = require('@polkadot/util-crypto')

const registry = new TypeRegistry()

/**
 * Javascript Class to interact with the Blockchain.
 */
module.exports = class Blockchain {
  constructor (server = 'ws://127.0.0.1:9944/') {
    this.providerWS = server
    this.api = false
    this.keypair = {}
    this.units = 1000000000
  }

  async connect () {
    debug('connecting to ' + this.providerWS)

    // 'wss://substrate-demo.caelumlabs.com/'
    this.provider = new WsProvider(this.providerWS)
    this.api = await ApiPromise.create({
      provider: this.provider,
      types: {
        Identity: {
          owner: 'AccountId',
          key_index: 'u64'
        },
        Key: {
          key: 'Vec<u8>',
          diddoc: 'Vec<u8>',
          valid_from: 'u64',
          valid_to: 'u64'
        }
      }
    })

    await cryptoWaitReady()

    const [chain, nodeName, nodeVersion] = await Promise.all([
      this.api.rpc.system.chain(),
      this.api.rpc.system.name(),
      this.api.rpc.system.version()
    ])

    /* let kZpair = await z.newKeyPair('root')
    console.log(kZpair)

    const keyring = new Keyring({ type: 'sr25519' });
    const newPair = keyring.addFromUri('//'+kZpair['root'].keypair.private_key);
    //
    const hexPair = keyring.addFromUri('0x80a0c8d8a5e27c75caa472fdcac6e24699a75144966d041f5909c4dc0e970b71');
    console.log(newPair.address)

    // Retrieve the account balance via the balances module
    const balance = await this.api.query.balances.freeBalance(hexPair.address)
    console.log("Balance "+balance) */

    debug(`Connected to chain ${chain} - ${nodeName} v${nodeVersion}`)
    return true
  }

  disconnect () {
    this.provider.disconnect()
  }

  async getKey (did) {
    return new Promise((resolve) => {
      this.api.query.lorenaModule.identities(did.toString()).then((identity) => {
        resolve(identity.zkey.toString())
      })
    })
  }

  /**
   *
   * @param {string} seed Seed
   * @param {boolean} isSeed Seed ot URI
   */
  setKeyring (seed, isSeed = false) {
    const keyring = new Keyring({ type: 'sr25519' })
    const uri = ((isSeed) ? '' : '//') + seed
    this.keypair = keyring.addFromUri(uri)
    debug('Keyring added:' + this.keypair.address)
  }

  async transfer (to, total) {
    return new Promise(async (resolve, reject) => {
      const ADDR = to
      const AMOUNT = total * this.units

      const balance = await this.api.query.balances.freeBalance(this.keypair.address)
      const nonce = await this.api.query.system.accountNonce(this.keypair.address)

      if (balance > AMOUNT) {
        this.api.tx.balances
          .transfer(ADDR, AMOUNT)
          .signAndSend(this.keypair, { nonce }, async ({ events = [], status }) => {
            if (status.isFinalized) {
              debug('Blockchain Transfer complete')
              resolve()
            }
          })
      }
    })
  }

  /**
   * Registers Did in Substrate .
   *
   * @param {string} did DID
   * @param {string} pubKey Zenroom Public Key
   *
   * Example:
   *    registerDid ('E348FEE8328', 'ZenroomValidPublicKey')
   */
  async registerDid (did, pubKey) {
    // Convert did string to hashed did, using Zenroom.Hash
    const hashedDID = Utils.stringToHash(did)
    // Convert pubKey to vec[u8]
    const arr = Utils.toUTF8Array(pubKey)
    const zkey = new Vec(registry, 'u8', arr)

    debug('Register did : ' + did)
    debug('Assign pubKey : ' + pubKey)
    debug('Register hashedDID : ' + hashedDID)
    debug('Assign zkey : ' + zkey)

    const transaction = await this.api.tx.lorenaModule.registerDid(hashedDID, zkey)
    await transaction.signAndSend(this.keypair)
  }

  /**
   * Returns the actual Key.
   *
   * @param {string} did DID
   * @returns {string} The active key
   */
  async getActualDidKey (did) {
    const hashedDID = Utils.stringToHash(did)
    const identity = await this.api.query.lorenaModule.identities(hashedDID)

    const result = await this.api.query.lorenaModule.identityKeys([hashedDID, identity.key_index.toString()])

    // let key = result.key.toString()
    // key = key.split('x')[1]
    // key = Buffer.from(key, 'hex').toString('utf8')
    return JSON.parse(result.toString())
  }

  async registerDidDocument (did, diddocHash) {
    const hashedDID = Utils.hashCode(did)
    const docHash = Utils.toUTF8Array(diddocHash)
    const transaction = await this.api.tx.lorenaModule.registerDidDocument(hashedDID, docHash)
    await transaction.signAndSend(this.keypair)
  }

  async getDidDocHash (did) {
    const hashedDID = Utils.hashCode(did)
    const identity = await this.api.query.lorenaModule.identities(hashedDID)
    const index = await this.api.query.lorenaModule.identityKeysIndex(identity.owner)
    const key = await this.api.query.lorenaModule.identityKeys([identity.owner, index])
    return key.diddoc_hash.toString()
  }

  async rotateKey (did, pubKey) {
    // Convert did string to hashed did
    const hashedDID = Utils.hashCode(did)
    // Convert pubKey to vec[u8]
    const keyArray = Utils.toUTF8Array(pubKey)
    // Call LorenaModule RotateKey function
    const transaction = await this.api.tx.lorenaModule.rotateKey(hashedDID, keyArray)
    await transaction.signAndSend(this.keypair)
  }
}
