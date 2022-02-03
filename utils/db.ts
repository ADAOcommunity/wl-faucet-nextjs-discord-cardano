const CosmosClient = require("@azure/cosmos").CosmosClient;
import { Container } from "@azure/cosmos";
import { IClaim, UtxoRecord, WhitelistedUser } from "../interfaces"
import sample from 'lodash.sample'

const key = process.env.COSMOS_KEY || "<cosmos key>";
const endpoint = process.env.COSMOS_ENDPOINT || "<cosmos endpoint>";
const databaseId = process.env.COSMOS_DATABASE || "<cosmos database>";
const utxoContainer = 'UtxoRecords'
const userContainer = 'WhitelistedUsers'


const getUtxoContainer = (): Container => {
    const client = new CosmosClient({ endpoint, key })
    return  client.database(databaseId).container(utxoContainer);
}

const getUserContainer = (): Container => {
    const client = new CosmosClient({ endpoint, key })
    return  client.database(databaseId).container(userContainer);
}

const inUseHashesQuery = (hashes: string[]) => {
    return {
        query: "SELECT * FROM t WHERE ARRAY_CONTAINS(@hashes, t.id, false)",
        parameters: [{
            name: "@hashes",
            value: hashes 
        }]
    }
};

export async function getInUseHashesArray(hashes: string[]): Promise<string[]> {
    console.log(hashes)
    const cont = getUtxoContainer()
    const { resources: items } = await cont.items.query(inUseHashesQuery(hashes)).fetchAll();
    if(items.length > 0) { 
        return items.map(item => item.id)
    } else {
        return []
    }
}

export async function getFreeHashesArray(hashes: string[]): Promise<string[]> {
    const busyHashes = await getInUseHashesArray(hashes)
    if(busyHashes.length > 0){
        hashes.filter(hash => !busyHashes.includes(hash))
    } else { 
        return hashes 
    }
}

export async function getFreeUxtoHash(hashes: string[]): Promise<string> {
    const freeHashes = await getFreeHashesArray(hashes)
    return sample(freeHashes)
}

const userWldAndUnclaimedQuery = (userid: string) => {
    return {
        query: "SELECT u.claimed FROM u WHERE u.id = @userid",
        parameters: [{
            name: "@userid",
            value: userid 
        }]
    }
};

export async function userWhitelistedAndClaimed(id: string): Promise<IClaim> {
    const cont = getUserContainer()
    const { resources: items } = await cont.items.query(userWldAndUnclaimedQuery(id)).fetchAll();
    if(items.length > 0) { 
        if(items[0].claimed === false) return { claimed: false, whitelisted: true}
        return { claimed: true, whitelisted: true}
    } else {
        return { claimed: true, whitelisted: false}
    }
}


export async function setUserClaimed(id: string) {
    const cont = getUserContainer()
    const wlUser = {
        id: id,
        claimed: true
    }
    await cont.item(id, id).replace(wlUser);
}

export async function addBusyUtxo(hash: string, usedById: string, txHash: string) {
    const cont = getUtxoContainer()
    const utxoRecord = {
        id: hash,
        used: new Date(),
        usedById: usedById,
        txHash: txHash
    }
    await cont.items.create(utxoRecord);
}

const usersClaimsQuery = (userid: string) => {
    return {
        query: "SELECT * FROM u WHERE u.usedById = @userid",
        parameters: [{
            name: "@userid",
            value: userid 
        }]
    }
};

export async function getUsersClaim(userId: string): Promise<UtxoRecord> {
    const cont = getUtxoContainer()
    const { resources: items } = await cont.items.query(usersClaimsQuery(userId)).fetchAll();
    if(items.length > 0) { 
        return items[0]
    } else {
        return null
    }
}