import { NextApiRequest, NextApiResponse } from "next";
import { verify } from 'jsonwebtoken'

// import { CardanoWalletBackend } from '../../../../cardano/cardano-wallet-backend';
import { addBusyUtxo, setUserClaimed, userWhitelistedAndClaimed } from "../../../../utils/db";
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
  try {
    userCookie = verify(req.cookies.token, process.env.JWT_SECRET)
  } catch (e) {
    return res.status(400).json('Token not valid')
  }
  if (!userCookie || !userCookie.id || userCookie.id.length !== 18) {
    return res.status(200).json({ response: '', error: 'User needs to be authenticated' })
  }
  let toClaim = false
  try {
    const claim = await userWhitelistedAndClaimed(userCookie.id)
    if (claim.whitelisted && !claim.claimed) toClaim = true
  } catch (err) {
    return res.status(200).json({ response: 'Nothing to claim', error: err });
  }
  // const toClaim = true
  if (!toClaim) return res.status(200).json({ response: 'Nothing to claim', error: '' })

  const transaction = tx.toString()
  const signature = sig.toString()
  // const wallet = new CardanoWalletBackend(blockfrostApiKey)
  // wallet.setPrivateKey(
  //   // privateKey
  //   process.env.WALLET_PRIV_KEY,
  //   process.env.WALLET_ADDRESS
  // );

  // let [txInputsFinal, recipientsFinal, metadata, fee] = await wallet.decodeTransaction(transaction, 0);

  // const isValid = validateTx(txInputsFinal, recipientsFinal)
  // if (!isValid) {
  //   return res.status(200).json({ txhash: '', error: "Transaction invalid" });
  // }
  // ///check inputs-outputs
  // const inFromUs = txInputsFinal.filter(input => input.address == beWalletAddr)
  // const ourUTXOHashes = inFromUs.map(inp => inp.utxoHashes?.split(',').filter(s => s.length > 2))?.reduce((prev, curr) => prev.concat(curr))
  // if (ourUTXOHashes.length != 1 || inFromUs[0].amount > 1999999) {
  //   return res.status(200).json({ txhash: '', error: "Transaction invalid" });
  // }
  // const beSig = wallet.signTx(tx);
  // const signatures = [signature, beSig];
  // const txHash = await wallet.submitTx({
  //   transactionRaw: transaction,
  //   witnesses: signatures,
  //   scripts: null,
  //   networkId: 0
  //   // networkId: 1
  // });
  // console.log("txHash")
  // console.log(txHash)

  // //if response looks like txHash, set used utxo as locked, set user as claimed
  // if (txHash.toString().length !== 64) {
  //   return res.status(200).json({ txhash: '', error: txHash });
  // } else {
    // addBusyUtxo setUserClaimed
    // await addBusyUtxo(ourUTXOHashes[0], userCookie.id, txHash.toString())
    // await setUserClaimed(userCookie.id)
    return res.status(200).json({ txhash: 'txHash', error: '' });
  // }

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