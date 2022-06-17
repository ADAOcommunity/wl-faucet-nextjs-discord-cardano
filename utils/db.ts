import { IClaim, UtxoRecord } from "../interfaces"
import sample from 'lodash.sample'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function getInUseHashesArray(hashes: string[]): Promise<string[]> {

    const items = await prisma.utxoRecord.findMany({
        where: {
            hash: { in: hashes },
        },
    })

    if (items && items.length > 0) {
        return items.map(item => item.hash)
    } else {
        return []
    }
}

export async function getFreeHashesArray(hashes: string[]): Promise<string[]> {
    const busyHashes = await getInUseHashesArray(hashes)
    if (busyHashes.length > 0) {
        hashes.filter(hash => !busyHashes.includes(hash))
    } else {
        return hashes
    }
}

export async function getFreeUxtoHash(hashes: string[]): Promise<string> {
    const freeHashes = await getFreeHashesArray(hashes)
    return sample(freeHashes)
}

export async function userWhitelistedAndClaimed(id: string): Promise<IClaim> {

    const wlRecord = await prisma.whitelistedUser.findFirst({ where: { id: id } })
    if (wlRecord) {
        if (wlRecord.claimed === false) return { claimed: false, whitelisted: true }
        return { claimed: true, whitelisted: true }
    } else {
        return { claimed: true, whitelisted: false }
    }
}


export async function setUserClaimed(id: string) {
    setUserNotClaimed(id, { claimed: true })
}

export async function setUserNotClaimed(id: string, claimed: null | { claimed: true } = null) {

    await prisma.whitelistedUser.update({
        where: {
            id: id,
        },
        data: {
            claimed: claimed ? claimed.claimed : false,
        },
    })
}

export async function addBusyUtxo(hash: string, usedById: string, txHash: string) {

    await prisma.utxoRecord.create({
        data: {
            used: new Date(),
            usedById: usedById,
            txHash: txHash,
            hash: hash
        }
    })
}


export async function getUsersClaim(userId: string): Promise<UtxoRecord> {

    return await prisma.utxoRecord.findFirst({where: {usedById: userId}})
}