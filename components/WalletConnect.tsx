import React, { useState, useContext, Fragment } from 'react'
import CardanoWallet from "../cardano/cardano-wallet"
import loader from '../cardano/cardano-wallet/loader'
import { Buffer } from 'buffer'
import WalletDropdown from './WalletDropdown'
import { useToast } from '../hooks/useToast';
import Checkbox from "../components/Checkbox";
import { BigNum } from '@emurgo/cardano-serialization-lib-browser'
import { Assets, C, Lucid, Tx, UTxO } from 'lucid-cardano'
import initializeLucid from '../utils/lucid'


const _Buffer = Buffer

export default function WalletConnect({successCallback} : {successCallback: (txid: any) => void}) {
    const [address, setAddress] = useState('')
    const [connected, setConnected] = useState(false)
    const [walletName, setWalletName] = useState('')
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState(true)
    const toast = useToast(3000);

    // const walletCtx = useContext(WalletContext)

    const setAddressBech32 = async (wallet: string) => {
        if(wallet) {
            let lib = await initializeLucid(wallet)
            console.log(wallet)
            const addr = await lib.wallet.address()
            if(addr) {
                setAddress(addr)
            }
        }
    }

    const checkboxData = (checkHandler) => {
        setResult(checkHandler)
        console.log(result)
    }

    const makeTx = async () => {
        setLoading(true)
        // const loaded = typeof loader !== 'undefined'

        // if(!loaded) {
        //     await loader.load()
        // }

        const lib = await initializeLucid(walletName)
        const res = await fetch(`/api/utxos/available`).then(res => res.json())
        if(res?.error) return toast('error', res.error)
        console.log('res')
        console.log(res)

        const localAssetCheck = '648823ffdad1610b4162f4dbc87bd47f6f9cf45d772ddef661eff19877444f4745'
        const serverAddress = "addr_test1vpeer9pltfdzalkk4psyxvc59pwxy9njf0zsk095zkutu8gcwx60f"
        const serverUtxo: UTxO = {
            txHash: res.tx_hash,
            outputIndex: res.output_index,
            assets: (() => {
              const a: Assets = {};
              res.amount.forEach((am: any) => {
                a[am.unit] = BigInt(am.quantity);
              });
              return a;
            })(),
            address: serverAddress,
            datumHash: res.data_hash,
        }
        let serverUtxoAssetCount: bigint = serverUtxo.assets[localAssetCheck] ? BigInt(serverUtxo.assets[localAssetCheck].toString()) : BigInt(0)

        const claimingAssetQt =  BigInt(5)

        const restAmount = (serverUtxoAssetCount - claimingAssetQt).toString()

        const userAddr = await lib.wallet.address();

        try {

            const tx = await Tx.new()
                .addSigner(userAddr)
                .addSigner(serverAddress)
                .collectFrom([serverUtxo])
                .payToAddress(serverAddress, { [localAssetCheck]: BigInt(restAmount), ['lovelace'] : BigInt(1500000)})
                .complete()
                
            let sTx = Buffer.from(tx.txComplete.to_bytes(), 'hex')
            let t = Buffer.from(C.Transaction.from_bytes(sTx).to_bytes()).toString('hex')
         
            const signature = await signTx(t)
            const submitRes = await submitReq(t, signature)
            console.log('submitRes')
            console.log(submitRes)

            if(submitRes.transactionId !== '') {
                successCallback(submitRes.transactionId)
                const resTxId = submitRes.transactionId
                toast('success', `Transaction ID ${resTxId}`)
            } 
            else if(submitRes.error) throw submitRes.error
            return submitRes

        } catch(err){
            console.log(err)
            toast('error', err.toString())
        }
        toast('error', "Transaction Cancelled")
        setLoading(false)
    }

    const submitReq = async (txHex: string, signatureHex: string) => {
        const rawResponse = await fetch(`http://localhost:8080/submit`, {
            // const rawResponse = await fetch(`http://localhost:8080/submit/${sig}`, {
            method: 'POST',
            headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
            },
            body: JSON.stringify({txHex: txHex, signatureHex: signatureHex})
        });
        console.log(rawResponse)
        return await rawResponse.json()
    }

    const signTx = async (txCbor: string) => {
        const api = await window.cardano[walletName].enable();
        console.log("Signing the tx")
        let witness: any = await api.signTx(txCbor, true);
        console.log("Witness created")
        return witness;
    }

    const enableCardano = async (wallet = 'nami') => {
        const win:any = window

        if(!win.cardano) return
  
        let baseWalletApi, fullWalletApi
        switch(wallet){
          case 'nami':
            baseWalletApi = win.cardano.nami
            break
          case 'eternl':
            baseWalletApi = win.cardano.eternl
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
          case 'eternl':
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
            setWalletName(wallet)
            setConnected(true)
            setAddressBech32(wallet)
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
                        <button onClick={() => {result == true ? toast("error", "Accept the Terms of Service to Claim") : makeTx(); setResult(true)}}
                            className="m-2 p-10 text-black font-bold rounded-xl transition-all duration-500 bg-gradient-to-br to-blue-500 via-white from-blue-900 bg-size-200 bg-pos-0 hover:bg-pos-100">
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
