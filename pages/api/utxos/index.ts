import type { NextApiRequest, NextApiResponse } from 'next';

import { CardanoWalletBackend } from '../../../cardano/cardano-wallet-backend';
const blockfrostApiKey = {
  0: `testnetRvOtxC8BHnZXiBvdeM9b3mLbi8KQPwzA`, // testnet
  1: `mainnetGHf1olOJblaj5LD8rcRudajSJGKRU6IL`, // mainnet
};

export default async function (req: NextApiRequest, res: NextApiResponse) {

  console.log(`default address`);

  const searchAddress = process.env.WALLET_ADDRESS
  const wallet = new CardanoWalletBackend(blockfrostApiKey);
  
  const beUtxos = await wallet.getAddressUtxos(searchAddress, 0)
  console.log(beUtxos)
  res.status(200).json(beUtxos);
}
