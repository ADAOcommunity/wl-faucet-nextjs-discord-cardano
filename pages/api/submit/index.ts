import { NextApiRequest, NextApiResponse } from "next";
import { verify } from 'jsonwebtoken'

import { addBusyUtxo, setUserClaimed, userWhitelistedAndClaimed } from "../../../utils/db";
import { decodeTransaction } from "../../../utils/cardano";
import initializeLucid from "../../../utils/lucid";
import { C } from "lucid-cardano";

const beWalletAddr = process.env.WALLET_ADDRESS

type SubmitReqBody = {
  txHex: string
  signatureHex: string
}

export default async (req: NextApiRequest, res: NextApiResponse) => {
  const submitReqBody: SubmitReqBody = req.body
  console.log(req.body)
  if (!submitReqBody || !submitReqBody.txHex || !submitReqBody.signatureHex) return res.status(400).json({ error: `signed Tx not provided`})

  if (!req.cookies.token) {
    return res.status(200).json({ error: 'User needs to be authenticated' })
  }
  let userCookie
  try {
    userCookie = verify(req.cookies.token, process.env.JWT_SECRET)
  } catch (e) {
    return res.status(400).json({ error: 'Token not valid'})
  }
  if (!userCookie || !userCookie.id || userCookie.id.length !== 18) {
    return res.status(200).json({ error: 'User needs to be authenticated' })
  }
  let toClaim = false
  try {
    const claim = await userWhitelistedAndClaimed(userCookie.id)
    if (claim.whitelisted && !claim.claimed) toClaim = true
  } catch (err) {
    return res.status(200).json({ error: err });
  }
  if (!toClaim) return res.status(200).json({ error: 'Nothing to claim' })

  const transactionHex = submitReqBody.txHex.toString()
  const signatureHex = submitReqBody.signatureHex.toString()


  let { txInputsFinal, recipientsFinal, metadata, fee } = await decodeTransaction(transactionHex);

  const isValid = validateTx(txInputsFinal, recipientsFinal)
  if (!isValid) {
    return res.status(200).json({ error: "Transaction invalid" });
  }
  ///check inputs-outputs
  const inFromUs = txInputsFinal.filter(input => input.address == beWalletAddr)
  const ourUTXOHashes = inFromUs.map(inp => inp.utxoHashes?.split(',').filter(s => s.length > 2))?.reduce((prev, curr) => prev.concat(curr))
  if (ourUTXOHashes.length != 1 || inFromUs[0].amount > 1999999) {
    return res.status(200).json({ error: "Transaction invalid" })
  }

  const transaction = C.Transaction.from_bytes(Buffer.from(transactionHex, 'hex'));

  const signatureSet = C.TransactionWitnessSet.from_bytes(Buffer.from(signatureHex, 'hex'));
  const signatureList = signatureSet.vkeys()

  if (!signatureList) return res.status(200).json({ error: "Signature invalid" })
  console.log("We've made it this far.")

  const transaction_body = transaction.body();

  const txBodyHash = C.hash_transaction(transaction_body);

  // let serverKey = process.env.SERVER_PRIVATE_KEY
  const serverKey = "2890e93efbb5599e9298286c777b0ab40225ecc52bcf190d4c30936ca8c03b4ba317159212a2f7092797d18ecd51205371c74120d096cab2a886df15c6f5e04f";

  const sKey = C.PrivateKey.from_extended_bytes(Buffer.from(serverKey, 'hex'))

  const witness = C.make_vkey_witness(
    txBodyHash,
    sKey
  );

  signatureList.add(witness);
  signatureSet.set_vkeys(signatureList);
  if(transaction.witness_set()?.native_scripts()) signatureSet.set_native_scripts(transaction.witness_set().native_scripts())
  
  let aux = C.AuxiliaryData.new()
  if(transaction.auxiliary_data()) aux = transaction.auxiliary_data()
  const signedTx = C.Transaction.new(transaction.body(), signatureSet, aux)
  const lib = await initializeLucid(null)
  let resS = null
  try {
    resS = await lib.provider.submitTx(signedTx)
  }
  catch(exc){
    return res.status(200).json({ error: exc });
  }

  // //if response looks like txHash, set used utxo as locked, set user as claimed
  if (resS.toString().length !== 64) {
    return res.status(200).json({ error: resS });
  } else {
    await addBusyUtxo(ourUTXOHashes[0], userCookie.id, resS.toString())
    await setUserClaimed(userCookie.id)
    return res.status(200).json({ txhash: resS.toString()});
  }
};

const validateTx = (txInputsFinal, recipientsFinal) => {
  let valueIn = 0
  let valueOut = 0
  for (let r of txInputsFinal) {
    if (r.address == beWalletAddr) {
      if(Array.isArray(r.assets)) {
        for (let a of r.assets) {
          if (a.unit == "648823ffdad1610b4162f4dbc87bd47f6f9cf45d772ddef661eff198.wDOGE") {
            valueIn += a.amount
          }
        }
      } else {
        if (r.assets.unit == "648823ffdad1610b4162f4dbc87bd47f6f9cf45d772ddef661eff198.wDOGE") {
          valueIn += r.assets.amount
        }
      }
      valueIn += r.amount;
    }
  }
  for (let r of recipientsFinal) {
    if (r.address = beWalletAddr) {
      valueOut += r.amount;
    }
  }
  return (valueIn - valueOut) < 741
}