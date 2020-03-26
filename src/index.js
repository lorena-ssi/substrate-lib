/* eslint-disable no-async-promise-executor */
'use strict'
const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api')
const { TypeRegistry } = require('@polkadot/types')
const { Vec } = require('@polkadot/types/codec')
const Utils = require('./utils')
const { cryptoWaitReady } = require('@polkadot/util-crypto')
const registry = new TypeRegistry()

// Debug
var debug = require('debug')('did:debug:sub')


/**
 * Javascript Class to interact with the Blockchain.
 */
module.exports = class Blockchain {

  /**
   * Constructor
   * 
   * @param {string} server Web Sockets Provider
   */
  constructor (server = 'ws://127.0.0.1:9944/') {
    this.providerWS = server
    this.api = false
    this.keypair = {}
    this.units = 1000000000
  }

  /**
   * Connect with the Blockchain.
   */
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
          diddoc_hash: 'Hash',
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

    debug(`Connected to chain ${chain} - ${nodeName} v${nodeVersion}`)
    return true
  }

  /**
   * Disconnect from Blockchain.
   */
  disconnect () {
    this.provider.disconnect()
  }

  /**
   * Balance fot the address.
   * TODO: Not working.
   */
  async balance () {
    return await this.api.query.balances.freeBalance(this.keypair.address)
  }

  /**
   * Returns the Key for a DID.
   * @param {string} did 
   */
  async getKey (did) {
    return new Promise((resolve) => {
      this.api.query.lorenaModule.identities(did.toString()).then((identity) => {
        resolve(identity.zkey.toString())
      })
    })
  }

  /**
   * Sets the Keyring
   * @param {string} seed Seed
   * @returns {string} Address
   */
  setKeyring (seed) {
    const keyring = new Keyring({ type: 'sr25519' })
    this.keypair = keyring.addFromUri((seed === 'Alice') ? '//Alice' : seed)
    debug('Keyring added:' + this.keypair.address)
    return this.keypair.address
  }

  /**
   * Transfer Tokens
   * TODO: Not working.
   * @param {string} to Address To
   * @param {*} total Ammount to send
   */
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
   * Receives a 16 bytes DID string and extends it to 65 bytes Hash
   * @param {string} did DID
   * @param {string} pubKey Public Key to register into the DID
  */ 
  async registerDid (did, pubKey) {
    debug('Register did : ' + did)
    debug('Assign pubKey : ' + pubKey)
    // Convert did string to hashed did
    const hashedDID = Utils.hashCode(did)

    // Convert pubKey to vec[u8]
    const arr = Utils.toUTF8Array(pubKey)
    const zkey = new Vec(registry, 'u8', arr)
    const transaction = await this.api.tx.lorenaModule.registerDid(hashedDID, zkey)
    await transaction.signAndSend(this.keypair)
  }

  /**
   * Returns the actual Key.
   * @param {string} did DID
   * @returns {string} The active key
   */
  async getActualDidKey (did) {
    const hashedDID = Utils.hashCode(did)
    const index = await this.api.query.lorenaModule.identityKeysIndex(hashedDID)
    const result = await this.api.query.lorenaModule.identityKeys([hashedDID, index])

    let key = result.key.toString()
    key = key.split('x')[1]
    key = Buffer.from(key, 'hex').toString('utf8')
    return key
  }

  /**
   * Registers a Hash (of the DID document) for a DID
   * @param {string} did DID
   * @param {string} diddocHash Did document Hash
   */
  async registerDidDocument (did, diddocHash) {
    const hashedDID = Utils.hashCode(did)
    const docHash = Utils.hashCode(diddocHash)
    const transaction = await this.api.tx.lorenaModule.registerDidDocument(hashedDID, docHash)
    await transaction.signAndSend(this.keypair)
  }

  /**
   * Retrieves the Hash of a Did Document for a DID
   * @param {string} did DID
   * @returns {string} the Hash
   */
  async getDidDocHash (did) {
    const hashedDID = Utils.hashCode(did)
    const identity = await this.api.query.lorenaModule.identities(hashedDID)
    const index = await this.api.query.lorenaModule.identityKeysIndex(identity.owner)
    const key = await this.api.query.lorenaModule.identityKeys([identity.owner, index])
    return key.diddoc_hash.toString()
  }

  /**
   * Rotate Key : chamges the actual key for a DID
   * @param {string} did DID
   * @param {string} diddocHash Did document Hash
   */
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
