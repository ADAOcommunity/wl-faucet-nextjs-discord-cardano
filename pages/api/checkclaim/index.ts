import { decode } from 'jsonwebtoken';
import type { NextApiRequest, NextApiResponse } from 'next';
import { ClaimRes, IClaim, UtxoRecord } from '../../../interfaces';
import { getUsersClaim } from '../../../utils/db';
import { CardanoWalletBackend } from '../../../cardano/cardano-wallet-backend';
const blockfrostApiKey = {
  0: `testnetRvOtxC8BHnZXiBvdeM9b3mLbi8KQPwzA`, // testnet
  1: `mainnetGHf1olOJblaj5LD8rcRudajSJGKRU6IL`, // mainnet
};

export default async function (req: NextApiRequest, res: NextApiResponse) {
    let claimRes: ClaimRes
    if (!req.cookies.token) {
        claimRes = { claim:  {claimed: false, whitelisted: false}, error: 'User needs to be authenticated' }
        return res.status(200).json(claimRes);
    }

    let decodedCookie = decode(req.cookies.token)
    const userCookie: any = typeof decodedCookie === 'object' ? decodedCookie : null

    if (!userCookie || !userCookie.id || userCookie.id.length !== 18) {
        claimRes = { claim:  {claimed: false, whitelisted: false}, error: 'User needs to be authenticated' }
        return res.status(200).json(claimRes);
    }

    let record: UtxoRecord

    try {
        record = await getUsersClaim(userCookie.id)
        if(record === null) {
            claimRes = { claim: {claimed: false, whitelisted: false}, error: "No claiming history. Contact us for support." }
            return res.status(200).json(claimRes);
        }
        var dt = new Date()
        dt.setHours( dt.getHours() - 5);

        if(dt > record.used) {
            const wallet = new CardanoWalletBackend(blockfrostApiKey);
            let tx = await wallet._blockfrostRequest({
                endpoint: `/txs/${record.txHash}`,
                networkId: 1,
                method: 'GET',
            });
            if(tx && tx.hash) {
                claimRes = { claim: {claimed: true, whitelisted: true}, error: `Your claiming transaction ${record.txHash} was already included in the blockchain.` }
                return res.status(200).json(claimRes);
            }
            else{
                //delete UTXO record
                //set claimed user false
                claimRes = { claim: {claimed: false, whitelisted: true}, error: `You can try again now. Ideally, use a new wallet with no other interactions accross Dapps.` }
                return res.status(200).json(claimRes);
            }
        } 
        else {
            claimRes = { claim: {claimed: true, whitelisted: true}, error: `Your claiming transaction is still pending, because of the congestion, wait at least 5 hours after you submit.` }
            return res.status(200).json(claimRes);
        }
       
    } catch(err) {
        claimRes = { claim: {claimed: false, whitelisted: false}, error: err }
        return res.status(200).json(claimRes);
    }
}
