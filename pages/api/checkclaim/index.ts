import { verify } from 'jsonwebtoken';
import type { NextApiRequest, NextApiResponse } from 'next';
import { ClaimRes, UtxoRecord } from '../../../interfaces';
import { getUsersClaim } from '../../../utils/db';
import bf from '../../../utils/blockfrost'

export default async function (req: NextApiRequest, res: NextApiResponse) {
    let claimRes: ClaimRes
    if (!req.cookies.token) {
        claimRes = { claim:  {claimed: false, whitelisted: false}, error: 'User needs to be authenticated' }
        return res.status(200).json(claimRes);
    }

    let userCookie
    try{
        userCookie = verify(req.cookies.token, process.env.JWT_SECRET)
    }catch(e){
        return res.status(400).json('Token not valid')
    }
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
        if(dt.getTime() > new Date(record.used).getTime()) {
            
            let tx = await bf({
                endpoint: `/txs/${record.txHash}`,
                method: 'GET'
            })
            if(tx && tx.hash) {
                claimRes = { claim: {claimed: true, whitelisted: true}, error: `Your claiming transaction ${record.txHash} was already included in the blockchain.` }
                return res.status(200).json(claimRes);
            }
            else{
                claimRes = { claim: {claimed: true, whitelisted: true}, error: `It seems like tx didn't go through. Please reach out to us on our discord.` }
                return res.status(200).json(claimRes);
            }
        } 
        else {
            claimRes = { claim: {claimed: true, whitelisted: true}, error: `Because of the congestion, wait at least 5 hours after you submit to try again.` }
            return res.status(200).json(claimRes);
        }
       
    } catch(err) {
        claimRes = { claim: {claimed: false, whitelisted: false}, error: err }
        return res.status(200).json(claimRes);
    }
}
