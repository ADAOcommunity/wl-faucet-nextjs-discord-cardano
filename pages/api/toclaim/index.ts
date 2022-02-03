import { decode } from 'jsonwebtoken';
import type { NextApiRequest, NextApiResponse } from 'next';
import { ClaimRes, IClaim } from '../../../interfaces';
import { userWhitelistedAndClaimed } from '../../../utils/db';

export default async function (req: NextApiRequest, res: NextApiResponse) {
    let claimRes: ClaimRes
    if (!req.cookies.token) {
        claimRes = { claim:  {claimed: false, whitelisted: false}, error: 'User needs to be authenticated' }
        return res.status(200).json(claimRes);
    }

    let decodedCookie = decode(req.cookies.token)
    const userCookie: any = typeof decodedCookie === 'object' ? decodedCookie : null

    if (!userCookie) {
        claimRes = { claim:  {claimed: false, whitelisted: false}, error: 'User needs to be authenticated' }
        return res.status(200).json(claimRes);
    }

    let claim: IClaim =  {claimed: false, whitelisted: false}
    console.log(userCookie.id)
    try {
        claim = await userWhitelistedAndClaimed(userCookie.id)
        console.log("claim")
        console.log(claim)
    } catch(err) {
        claimRes = { claim: claim, error: err }
        return res.status(200).json(claimRes);
    }

    return res.status(200).json({ claim: claim, error: '' });
}
