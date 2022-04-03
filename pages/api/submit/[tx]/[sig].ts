import { NextApiRequest, NextApiResponse } from "next";
import { decode, verify } from 'jsonwebtoken'

import { CardanoWalletBackend } from '../../../../cardano/cardano-wallet-backend';
import { addBusyUtxo, setUserClaimed } from "../../../../utils/db";
const blockfrostApiKey = {
  0: `testnetRvOtxC8BHnZXiBvdeM9b3mLbi8KQPwzA`, // testnet
  1: `mainnetGHf1olOJblaj5LD8rcRudajSJGKRU6IL`, // mainnet
};

const beWalletAddr = process.env.WALLET_ADDRESS

export default async (req: NextApiRequest, res: NextApiResponse) => {
  const { tx = null, sig = null } = req.query

  if (!tx || !sig) return res.status(400).json(`signed Tx not provided`)

  if (!req.cookies.token) {
    return res.status(200).json({ response: '', error: 'User needs to be authenticated' })
  }
  let userCookie
  try{
    userCookie = verify(req.cookies.token, process.env.JWT_SECRET)
  }catch(e){
    res.status(400).json('Token not valid')
  }
  if (!userCookie || !userCookie.id || userCookie.id.length !== 18) {
      return res.status(200).json({ response: '', error: 'User needs to be authenticated' })
  }
  const toClaim = true

  if(!toClaim) return res.status(200).json({ response: 'Nothing to claim', error: '' })

  const transaction = tx.toString()
  const signature = sig.toString()
  // console.log("transaction")
  // console.log(transaction)
  const wallet = new CardanoWalletBackend(blockfrostApiKey)
  // let privateKey = wallet.createNewBech32PrivateKey()
  // console.log("privateKey")
  // console.log(privateKey)
  wallet.setPrivateKey(
    // privateKey
    process.env.WALLET_PRIV_KEY,
    process.env.WALLET_ADDRESS
  );
  // console.log("set privateKey")
  
  let [txInputsFinal, recipientsFinal, metadata, fee] = await wallet.decodeTransaction(transaction, 1);

  const isValid = validateTx(txInputsFinal, recipientsFinal)
  // console.log("txInputsFinal, recipientsFinal, metadata, fee")
  // console.log(txInputsFinal, recipientsFinal, metadata, fee)
  if(!isValid) {
    return  res.status(200).json({ txhash: '', error: "Transaction invalid" });
  }
  ///check inputs-outputs
  const inFromUs = txInputsFinal.filter(input => input.address == beWalletAddr)
  const ourUTXOHashes = inFromUs.map(inp => inp.utxoHashes?.split(',').filter(s=> s.length > 2))?.reduce((prev, curr) => prev.concat(curr))
  // console.log("inFromUs")
  // console.log(inFromUs)
  // console.log("ourUTXOHashes")
  // console.log(ourUTXOHashes)
  if(ourUTXOHashes.length != 1 || inFromUs[0].amount > 1999999) {
    return  res.status(200).json({ txhash: '', error: "Transaction invalid" });
  }

  const beSig = wallet.signTx(tx);
  
  const signatures = [signature, beSig];

  const txHash = await wallet.submitTx({
    transactionRaw: transaction,
    witnesses: signatures,
    scripts: null,
    networkId: 1
  });
  console.log("txHash")
  console.log(txHash)

  if(txHash.toString().length !== 64) {
    return  res.status(200).json({ txhash: '', error: txHash });
  } else {

    // addBusyUtxo setUserClaimed
    await addBusyUtxo(ourUTXOHashes[0], userCookie.id, txHash.toString())
    await setUserClaimed(userCookie.id)
    return  res.status(200).json({ txhash: txHash, error: '' });
  }

  // const txHash = "12345"

///if response looks like txHash, set used utxo as locked, set user as claimed

///else
/////res.status(200).json({ txhash: '', error: txHash });

};

const validateTx = (txInputsFinal, recipientsFinal) => {
  let valueIn = 0
  let valueOut = 0
  for (let r of txInputsFinal) {
    if (r.address == beWalletAddr) {
      for (let a of r.assets) {
        if (a.unit == "57fca08abbaddee36da742a839f7d83a7e1d2419f1507fcbf3916522.CHOC") {
          valueIn += a.amount
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