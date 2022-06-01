import type { NextApiRequest, NextApiResponse } from 'next';
import { Utxo } from '../../../interfaces'
import { getInUseHashesArray } from '../../../utils/db';
import { CardanoWalletBackend } from '../../../cardano/cardano-wallet-backend';
import sample from 'lodash.sample';
import { Console } from 'console';

const blockfrostApiKey = {
    0: `testnetRvOtxC8BHnZXiBvdeM9b3mLbi8KQPwzA`, // testnet
    1: `mainnetGHf1olOJblaj5LD8rcRudajSJGKRU6IL`, // mainnet
};

export default async function (req: NextApiRequest, res: NextApiResponse) {

    // console.log(process.env.WALLET_ADDRESS);
    // const body = req.body

    const searchAddress = process.env.WALLET_ADDRESS
    const wallet = new CardanoWalletBackend(blockfrostApiKey);
    const addrUtxos: Utxo[] = await wallet.getAddressUtxos(searchAddress, 0)
    if(!addrUtxos || addrUtxos.length < 1 || !addrUtxos[0].tx_hash) return res.status(200).json('ERROR: No utxos are currently available');
    
    const busyUtxoHashes: string[] = await getInUseHashesArray(addrUtxos.map(u => `${u.tx_hash}_${u.output_index}`))
    let availableUtxos
    if(!busyUtxoHashes || busyUtxoHashes.length < 1) {
        availableUtxos = addrUtxos
    } else {
        availableUtxos = addrUtxos.filter(utxo => !busyUtxoHashes.includes(`${utxo.tx_hash}_${utxo.output_index}`))
    }
    if(availableUtxos.length > 0){
        const chooseRandom = sample(availableUtxos)
        return res.status(200).json(chooseRandom);
    } else {
        return res.status(200).json({error: "No utxos are currently available"});
    }
}
