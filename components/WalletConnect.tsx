import React, { useState, useContext, Fragment } from 'react'
import CardanoWallet from "../cardano/cardano-wallet"
import loader from '../cardano/cardano-wallet/loader'
import { Buffer } from 'buffer'
import WalletDropdown from './WalletDropdown'
import { useToast } from '../hooks/useToast';
import Checkbox from "../components/Checkbox";

let wallet
const _Buffer = Buffer

export default function WalletConnect({successCallback} : {successCallback: (txid: any) => void}) {
    const [address, setAddress] = useState('')
    const [connected, setConnected] = useState(false)
    const [walletState, setWalletState] = useState()
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState(true)
    const toast = useToast(3000);

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

    const checkboxData = (checkHandler) => {
        setResult(checkHandler)
        console.log(result)
    }


    const makeTx = async () => {
        setLoading(true)
        let blockfrostApiKey = {
            0: "testneto48QlLzZUqe1bLNas393LNKOAzAsJNOE", // testnet
            1: "mainnetlBYozUOJH7r3Lm0p7qarAwvxQRTWZSRY" // mainnet
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
        console.log(utxos)
        const res = await fetch(`/api/utxos/available`).then(res => res.text())
        console.log("da response")
        console.log(res)
        console.log("utxos")
        console.log(utxos)
        utxos = utxos.concat(res)
        console.log("utxos concat")
        console.log(utxos)
        const myAddress = await wallet.getAddress();
        let netId = await wallet.getNetworkId();
        // const recipients = [{ "address": "addr_test1qp0eplnevhtnslafjnu2485qa35s88df7hw6u035wkax982r4edrmtyrjncfd6tluhtlhrlvqsjw3nuyegafvsmfgukqj55zet", "amount": "1" }]
        let recipients = [
            {address: "addr1q95lhw09ljm0zyen8nuyw2ypgyss5gnxq5dczutne793qa8wch5z2p0luu3x04xj70ljrvts5k8v46lc3rmwjdtqjhpsg4xs6p", amount: "2.5"}, // Seller Wallet, NFT price 10ADA
            {address: `${myAddress}`,  amount: "0",
            //  assets:[{"unit":"bd0d0207adcebd72977271949c96bf78bd0ae7af448f0a1561998268.OG","quantity":"1"}]
            } // NFTs to be sent
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
        toast('error', "Transaction Cancelled")
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
                    <div>
                        <button disabled={result} onClick={() => {makeTx(); setResult(true);}} className="m-2 p-10 text-black font-bold rounded-xl transition-all duration-500 bg-gradient-to-br to-blue-500 via-white from-blue-900 bg-size-200 bg-pos-0 hover:bg-pos-100">
                        <h2>
                            Claim
                        </h2>
                        </button>
                        <Checkbox checkboxData={checkboxData}/>
                    </div>
                    
                :
                <></>
                }
            </div>
            <WalletDropdown enableWallet={enableCardano} address={address}/>
        </div>
    )
}
