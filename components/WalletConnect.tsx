import React, { useState, useContext, Fragment } from 'react'
import CardanoWallet from "../cardano/cardano-wallet"
import loader from '../cardano/cardano-wallet/loader'
import { Buffer } from 'buffer'
import WalletDropdown from './WalletDropdown'

let wallet
const _Buffer = Buffer

export default function WalletConnect({successCallback} : {successCallback: (txid: any) => void}) {
    const [address, setAddress] = useState('')
    const [connected, setConnected] = useState(false)
    const [walletState, setWalletState] = useState()
    const [loading, setLoading] = useState(false)

    // const walletCtx = useContext(WalletContext)

    const setAddressBech32 = async (walletApi) => {
        if(walletApi) {
            await loader.load()
            const loaded = typeof loader !== 'undefined'
            console.log("loader")
            console.log(loaded)
            if(loaded) {
                const loadedLoader = loader
                const address = (await walletApi.getUsedAddresses())[0]
                const addReadable = loadedLoader.Cardano.Address.from_bytes(_Buffer.from(address, 'hex')).to_bech32()
                console.log(addReadable)
                setAddress(addReadable)
            }
        }
    }

    const makeTx = async () => {
        setLoading(true)
        let blockfrostApiKey = {
            0: "testnetRvOtxC8BHnZXiBvdeM9b3mLbi8KQPwzA", // testnet
            1: "mainnetGHf1olOJblaj5LD8rcRudajSJGKRU6IL" // mainnet
            }
        
        console.log("makeTx")
        const loaded = typeof loader !== 'undefined'
        console.log("loader")
        console.log(loaded)

        const loadedLoader = loader

        if(!loaded) {
            await loader.load()
        }
        console.log("1")
        const S = loadedLoader.Cardano
        console.log("2")
        wallet = new CardanoWallet(
                        S,
                        walletState,
                        blockfrostApiKey
                    )
        let utxos = await wallet.getUtxosHex();
        const res = await fetch(`/api/utxos/available`).then(res => res.text())
        console.log("res")
        console.log(res)
        console.log("utxos")
        console.log(utxos)
        utxos = utxos.concat(res)
        console.log("utxos concat")
        console.log(utxos)
        const myAddress = await wallet.getAddress();
        let netId = await wallet.getNetworkId();
        // const recipients = [{ "address": "addr1qx4suzvst55qy2ppyu5c4x2kct23kv6r26n6nhckqn3f22sjftnu9ft6l5qr2x49r5kg3wda6les343sa9cpcxjz40sqst8yae", "amount": "1" }]
        let recipients = [
            {address: "addr1qx8p9zjyk2us3jcq4a5cn0xf8c2ydrz2cxc5280j977yvc0gtg8vh0c9sp7ce579jhpmynlk758lxhvf52sfs9mrprws3mseux", amount: "2.5"}, // Seller Wallet, NFT price 10ADA
            {address: `${myAddress}`,  amount: "0",
             assets:[{"unit":"bc25d07c8629c0695e4ec54367f6471b23fe7882b4538806ffeb8328.SoundMoney","quantity":"1000"}]} // NFTs to be sent
            ]
        try {
            const t = await wallet.transaction({
                PaymentAddress: myAddress,
                utxosRaw: utxos,
                recipients: recipients,
                addMetadata: false,
                multiSig: true,
                networkId: netId.id,
                ttl: 18000
            })
       
            const signature = await wallet.signTx(t, true)
            const res = await fetch(`/api/submit/${t}/${signature}`).then(res => res.json())

            if(res.txhash !== '') {
                successCallback(res.txhash)
            }
            // const res = 'res-temp'
            // const txhash = await wallet.submitTx({transactionRaw: t, witnesses: [signature], networkId: 1})
            console.log(`${res}`)
        }
        catch(err){
            console.log(err)
            
        }

        setLoading(false)
        
    }

    const enableCardano = async (wallet = 'nami') => {
        const win:any = window

        if(!win.cardano) return
  
        let baseWalletApi, fullWalletApi
        switch(wallet){
          case 'nami':
            baseWalletApi = win.cardano.nami
            break
          case 'ccvault':
            baseWalletApi = win.cardano.ccvault
            break
          case 'flint':
            baseWalletApi = win.cardano.flint
            break
        default:
            break
        }
  
        switch(wallet){
          case 'nami':
            fullWalletApi = await baseWalletApi.enable()
            break
          case 'ccvault':
            fullWalletApi = await baseWalletApi.enable()
            break
          case 'flint':
            fullWalletApi = await baseWalletApi.enable()
            break
          default:
            break
        }

        if(!await baseWalletApi.isEnabled()) return
        else {
            console.log(fullWalletApi)
            wallet = fullWalletApi
            setWalletState(fullWalletApi)
            setConnected(true)
            setAddressBech32(fullWalletApi)
            
        }
    }

    return (
           <div style={{flexDirection: "column"}} className="flex items-center justify-center space-x-2">
            <div className="flex">   
                {connected ? 
                    loading ?
                    <>
                        <div className="flex items-center justify-center space-x-2">
                        <div className="spinner-grow inline-block w-8 h-8 bg-current rounded-full opacity-0 text-blue-300" role="status">
                            <span className="visually-hidden">Loading...</span>
                        </div>
                        </div>
                    </>
                    : 
                    <button onClick={() => makeTx()} className="m-2 p-10 text-white rounded-xl transition-all duration-500 bg-gradient-to-br to-blue-500 via-black from-blue-900 bg-size-200 bg-pos-0 hover:bg-pos-100">
                    <h2>
                        Claim
                    </h2>
                    </button> 
                :
                <></>
                }
            </div>
            <WalletDropdown enableWallet={enableCardano} address={address}/>
        </div>
    )
}
