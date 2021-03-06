import { Blockfrost, WalletProvider, Lucid, Assets, C } from 'lucid-cardano'

const initializeLucid = async (walletName: string = null) => {
    await Lucid.initialize(
        new Blockfrost('https://cardano-testnet.blockfrost.io/api/v0', 'testnetRvOtxC8BHnZXiBvdeM9b3mLbi8KQPwzA'),
        'Testnet'
    )
    if(walletName) await Lucid.selectWallet(walletName as WalletProvider)
    return Lucid
}

export default initializeLucid
