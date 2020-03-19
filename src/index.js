/* eslint-disable no-async-promise-executor */
'use strict'
const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api')
const { TypeRegistry } = require('@polkadot/types')
const { Vec } = require('@polkadot/types/codec')
const Utils = require('../utils/utils')
const { cryptoWaitReady } = require('@polkadot/util-crypto')

// Logger
const Logger = require('./logger')
const logger = new Logger()
const registry = new TypeRegistry()

/**
 * Javascript Class to interact with the Blockchain.
 */
module.exports = class Blockchain {
  constructor () {
    this.providerWS = process.env.SERVER_SUBSTRATE || 'ws://localhost'
    this.api = false
    this.keypair = {}
    this.units = 1000000000
  }

  /**
   * Connect to the blockchain with the configured provider
   */
  async connect () {
    const provider = new WsProvider(this.providerWS)
    this.api = await ApiPromise.create({
      provider,
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

    logger.log(`You are connected to chain ${chain} using ${nodeName} v${nodeVersion}`)
    return true
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
  }

  balance () {
    return new Promise((resolve) => {
      this.api.query.balances.freeBalance(this.keypair.address)
        .then((balance) => {
          resolve(balance / this.units)
        })
    })
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
              console.log('Blockchain Transfer complete')
              resolve()
            }
          })
      }
    })
  }

  //  Receives a 16 bytes DID string and extends it to 65 bytes Hash
  async registerDid (did, pubKey, cb) {
    // Convert did string to hashed did
    const hashedDID = Utils.hashCode(did)

    // Convert pubKey to vec[u8]
    const arr = Utils.toUTF8Array(pubKey)
    // console.log('arr:', arr)
    const zkey = new Vec(registry, 'u8', arr)
    // const zkey = pubKey
    // const zkey = pubKey.btoa()
    console.log(`RegisterDid function - DID: ${hashedDID}, pubKey:${pubKey}, zkey: ${zkey}`)

    const transaction = await this.api.tx.lorenaModule.registerDid(hashedDID, zkey)

    try {
      const txHash = await transaction
        .signAndSend(this.keypair, (result) => {
          console.log(`Current status is ${result.status}`)

          if (result.status.isInBlock) {
            console.log(`Transaction included at blockHash ${result.status.asInBlock}`)
          } else if (result.status.isFinalized) {
            console.log(`Transaction finalized at blockHash ${result.status.asFinalized}`)
            if (cb) {
              cb()
            }
            txHash()
          }
        })
      // console.log('Status TRANSACTION:', txHash)
      return did
    } catch (error) {
      console.log('Error!!!', error)
    }
  }

  async getActualDidKey (did) {
    const hashedDID = Utils.hashCode(did)
    const identity = await this.api.query.lorenaModule.identities(hashedDID)
    // console.log('identities - owner:' + identity.owner + ' Key Index: ' + identity.key_index.toString())
    // console.log('IDENTITY', identity)
    const index = await this.api.query.lorenaModule.identityKeysIndex(identity.owner)
    // console.log('identityKeysIndex - key timestamp:', index.toNumber())
    const key = await this.api.query.lorenaModule.identityKeys([identity.owner, index])
    // console.log(`DID: ${hashedDID}, Index: ${index.toNumber()}, Key: ${Buffer.from(key,'hex').toString('base64')}`)
    return key.key.toString()
  }

  async registerDidDocument (did, diddocHash) {
    const hashedDID = Utils.hashCode(did)
    const docHash = Utils.hashCode(diddocHash)
    await this.api.tx.lorenaModule.registerDidDocument(hashedDID, docHash)
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
    // Call lorenaModule RotateKey function
    await this.api.tx.lorenaModule.rotateKey(hashedDID, keyArray)
  }
}
