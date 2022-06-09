import type { NextApiRequest, NextApiResponse } from 'next';

import initializeLucid, { assetsToJsonString } from '../../../utils/lucid';

export default async function (req: NextApiRequest, res: NextApiResponse) {
  const searchAddress = process.env.WALLET_ADDRESS
  const lib = await initializeLucid(null)
  const beUtxos = await lib.provider.getUtxos(searchAddress)
  console.log(beUtxos)
  res.status(200).json(beUtxos.map(utxo => {
    return {
      txHash: utxo.txHash,
      outputIndex: utxo.outputIndex,
      assets: assetsToJsonString(utxo.assets),
      address: utxo.address,
      datumHash: utxo.datumHash,
      datum: utxo.datum,
    }
  }));
}
