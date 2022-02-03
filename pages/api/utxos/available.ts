import type { NextApiRequest, NextApiResponse } from 'next';
import { Utxo } from '../../../interfaces'
import { getInUseHashesArray } from '../../../utils/db';
import { CardanoWalletBackend } from '../../../cardano/cardano-wallet-backend';
import sample from 'lodash.sample';

const blockfrostApiKey = {
    0: `testnetRvOtxC8BHnZXiBvdeM9b3mLbi8KQPwzA`, // testnet
    1: `mainnetGHf1olOJblaj5LD8rcRudajSJGKRU6IL`, // mainnet
};

export default async function (req: NextApiRequest, res: NextApiResponse) {

    // console.log(process.env.WALLET_ADDRESS);
    // const body = req.body

    const searchAddress = process.env.WALLET_ADDRESS
    const wallet = new CardanoWalletBackend(blockfrostApiKey);

    const addrUtxos: Utxo[] = await wallet.getAddressUtxos(searchAddress)
    
    const busyUtxoHashes: string[] = await getInUseHashesArray(addrUtxos.map(u => `${u.tx_hash}_${u.output_index}`))//['7abbc44194a6fabad72607b899c5e364c0e935fc2315118c3aec6c9d7dd5af50_0']//get busy hashes
    let availableUtxos
    if(!busyUtxoHashes || busyUtxoHashes.length < 1) {
        availableUtxos = addrUtxos
    } else {
        availableUtxos = addrUtxos.filter(utxo => !busyUtxoHashes.includes(`${utxo.tx_hash}_${utxo.output_index}`))
    }

    const convertedUtxos = await Promise.all(availableUtxos.map(async utxo => await wallet.utxoToHex(utxo, searchAddress)))
    
    const chooseRandom = sample(convertedUtxos)
    res.status(200).json(chooseRandom);
}
