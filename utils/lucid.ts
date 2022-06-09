import { Blockfrost, WalletProvider, Lucid, Assets } from 'lucid-cardano'

const initializeLucid = async (walletName: string = null) => {
    await Lucid.initialize(
        new Blockfrost('https://cardano-testnet.blockfrost.io/api/v0', 'testnetRvOtxC8BHnZXiBvdeM9b3mLbi8KQPwzA'),
        'Testnet'
    )
    if(walletName) await Lucid.selectWallet(walletName as WalletProvider)
    return Lucid
}

export default initializeLucid

const assetsToJsonString = (assets: Assets) => {
    const assetsObj = {}
    Object.keys(assets).forEach(
        unit => assetsObj[unit] = assets[unit].toString()
    )
    return JSON.stringify(assetsObj)
}

const assetsFromJson = (assets: { [unit: string]: string }) => {
    const assetsObj = {}
    Object.keys(assets).forEach(
        unit => assetsObj[unit] = BigInt(assets[unit])
    )
    return assetsObj
}

export { assetsToJsonString, assetsFromJson }