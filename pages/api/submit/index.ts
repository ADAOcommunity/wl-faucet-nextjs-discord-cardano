import { NextApiRequest, NextApiResponse } from "next";
import Bottleneck from 'bottleneck';
import { verify } from 'jsonwebtoken'

import { addBusyUtxo, setUserClaimed, userWhitelistedAndClaimed } from "../../../utils/db";
import { decodeTransaction } from "../../../utils/cardano";
import initializeLucid from "../../../utils/lucid";
import { C } from "lucid-cardano";

const beWalletAddr = process.env.WALLET_ADDRESS

const limiter = new Bottleneck({
  maxConcurrent: 1
})

type SubmitReqBody = {
  txHex: string
  signatureHex: string
}

export default async (req: NextApiRequest, res: NextApiResponse) => {
  const submitReqBody: SubmitReqBody = req.body
  console.log(req.body)
  if (!submitReqBody || !submitReqBody.txHex || !submitReqBody.signatureHex) return res.status(400).json({ error: `correct request body not provided` })

  if (!req.cookies.token) {
    return res.status(200).json({ error: 'User needs to be authenticated' })
  }
  let userCookie
  try {
    userCookie = verify(req.cookies.token, process.env.JWT_SECRET)
  } catch (e) {
    return res.status(400).json({ error: 'Token not valid' })
  }
  if (!userCookie || !userCookie.id || userCookie.id.length !== 18) {
    return res.status(200).json({ error: 'User needs to be authenticated' })
  }

  const transactionHex = submitReqBody.txHex.toString()

  const signatureHex = submitReqBody.signatureHex.toString()

  return res.status(200).json(
    await limiter.schedule(() => submitJob(userCookie.id, transactionHex, signatureHex))
  )
}

const submitJob = async (userCookieId: string, transactionHex: string, signatureHex: string) => {
  let toClaim = false
  try {
    const claim = await userWhitelistedAndClaimed(userCookieId)
    if (claim.whitelisted && !claim.claimed) toClaim = true
  } catch (err) {
    return { error: err }
  }
  if (!toClaim) return { error: 'Nothing to claim' }

  let { txInputsFinal, recipientsFinal, metadata, fee } = await decodeTransaction(transactionHex);

  console.log('{ txInputsFinal, recipientsFinal}')
  console.log({ 
    txInputsFinal: txInputsFinal.map(i => {
      return {
        assets: JSON.stringify(i.assets),
        utxoHashes: i.utxoHashes,
        amount: i.amount,
        address: i.address
      }
    }),
    recipientsFinal: recipientsFinal.map(r => {
      return {
        assets: JSON.stringify(r.assets),
        amount: r.amount,
        address: r.address
      }
    })
  })

  const isValid = validateTx(transactionHex)
  if (!isValid) {
    return { error: "Transaction invalid" }
  }
  ///check inputs-outputs
  const inFromUs = txInputsFinal.filter(input => input.address == beWalletAddr)
  const ourUTXOHashes = inFromUs.map(inp => inp.utxoHashes?.split(',').filter(s => s.length > 2))?.reduce((prev, curr) => prev.concat(curr))
  if (ourUTXOHashes.length != 1 || inFromUs[0].amount > 1999999) {
    return { error: "Transaction invalid" }
  }

  const transaction = C.Transaction.from_bytes(Buffer.from(transactionHex, 'hex'))

  const signatureSet = C.TransactionWitnessSet.from_bytes(Buffer.from(signatureHex, 'hex'))
  const signatureList = signatureSet.vkeys()

  if (!signatureList) return { error: "Signature invalid" }
  console.log("We've made it this far.")

  const transaction_body = transaction.body()

  const txBodyHash = C.hash_transaction(transaction_body)

  // let serverKey = process.env.SERVER_PRIVATE_KEY
  const serverKey = "2890e93efbb5599e9298286c777b0ab40225ecc52bcf190d4c30936ca8c03b4ba317159212a2f7092797d18ecd51205371c74120d096cab2a886df15c6f5e04f";

  const sKey = C.PrivateKey.from_extended_bytes(Buffer.from(serverKey, 'hex'))

  const witness = C.make_vkey_witness(
    txBodyHash,
    sKey
  );

  signatureList.add(witness);
  signatureSet.set_vkeys(signatureList);
  if (transaction.witness_set()?.native_scripts()) signatureSet.set_native_scripts(transaction.witness_set().native_scripts())

  let aux = C.AuxiliaryData.new()
  if (transaction.auxiliary_data()) aux = transaction.auxiliary_data()
  const signedTx = C.Transaction.new(transaction.body(), signatureSet, aux)
  const lib = await initializeLucid(null)
  let resS = null
  try {
    resS = await lib.provider.submitTx(signedTx)
  }
  catch (exc) {
    const errMsg = exc.info || exc.message || exc || ''
    return { error: errMsg }
  }

  // //if response looks like txHash, set used utxo as locked, set user as claimed
  if (!resS || resS.toString().length !== 64) {
    console.log('Submit res:')
    console.log(resS)
    return { error: resS }
  } else {
    await addBusyUtxo(ourUTXOHashes[0], userCookieId, resS.toString())
    await setUserClaimed(userCookieId)
    return { txhash: resS.toString() }
  }
}

const validateTx = async (transactionHex: string) => {

  let { txInputsFinal, recipientsFinal, metadata, fee } = await decodeTransaction(transactionHex);

  console.log('{ txInputsFinal, recipientsFinal}')
  console.log({ 
    txInputsFinal: txInputsFinal.map(i => {
      return {
        assets: JSON.stringify(i.assets),
        utxoHashes: i.utxoHashes,
        amount: i.amount,
        address: i.address
      }
    }),
    recipientsFinal: recipientsFinal.map(r => {
      return {
        assets: JSON.stringify(r.assets),
        amount: r.amount,
        address: r.address
      }
    })
  })

  const unitToCheck = '648823ffdad1610b4162f4dbc87bd47f6f9cf45d772ddef661eff198.wDOGE'
  let valueInLovelace = 0
  let valueInToken = 0
  let valueOutLovelace = 0
  let valueOutToken = 0

  for (let i of txInputsFinal) {
    if (i.address == beWalletAddr) {
      if (i.assets[unitToCheck]) {
        valueInToken += i.assets[unitToCheck]
      }
      valueInLovelace += i.amount
    }
  }
  for (let r of recipientsFinal) {
    if (r.address = beWalletAddr) {
      if (r.assets[unitToCheck]) {
        valueOutToken += r.assets[unitToCheck]
      }
      valueOutLovelace += r.amount
    }
  }
  return (
    (valueInLovelace - valueOutLovelace) < (1 * 1000000) && (valueInToken - valueOutToken) < 5
  )
}