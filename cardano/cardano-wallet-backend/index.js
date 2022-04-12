var S = require('@emurgo/cardano-serialization-lib-nodejs');
var Buffer = require('buffer').Buffer;
const fetchPromise = import('node-fetch').then((mod) => mod.default);
const fetch = (...args) => fetchPromise.then((fetch) => fetch(...args));
const ERROR = {
  FAILED_PROTOCOL_PARAMETER:
    'Couldnt fetch protocol parameters from blockfrost',
  TX_TOO_BIG: 'Transaction too big',
};

function harden(num) {
  return 0x80000000 + num;
}

class CardanoWalletBackend {
  constructor(blockfrostApiKey) {
    this.blockfrostApiKey = blockfrostApiKey;
    this.privateKey = null;
    this.accountKey = null;
    this.paymentKey = null;
    this.utxoPubKey = null;
    this.stakeKey = null;
    this.baseAddr = null;
  }

  setPrivateKey(bech32PrivateKey, address) {
    console.log('setting private key')
    console.log("bech32PrivateKey, address")
    console.log(bech32PrivateKey, address)
    // generating all keys following https://github.com/Emurgo/cardano-serialization-lib/blob/master/doc/getting-started/generating-keys.md
    this.privateKey = S.Bip32PrivateKey.from_bech32(bech32PrivateKey);

    this.accountKey = this.privateKey
      .derive(harden(1852)) // purpose
      .derive(harden(1815)) // coin type
      .derive(harden(0)); // account #0

    this.paymentKey = this.accountKey
      .derive(0) // external
      .derive(0);

    this.utxoPubKey = this.accountKey
      .derive(0) // external
      .derive(0)
      .to_public();

    this.stakeKey = this.accountKey
      .derive(2) // chimeric
      .derive(0);

    this.baseAddr = address ? address : S.EnterpriseAddress.new(
      S.NetworkInfo.mainnet().network_id(),
      S.StakeCredential.from_keyhash(this.utxoPubKey.to_raw_key().hash())
    ).to_address().to_bech32()

    console.log('key successfully set!');
    console.log(`address: ${this.baseAddr}`);
  }
  createNewBech32PrivateKey() {
    let key = S.Bip32PrivateKey.generate_ed25519_bip32();
    return key.to_bech32();
  }

  getApiKey(networkId) {
    return this.blockfrostApiKey[networkId];
  }

  async createLockingPolicyScript(networkId, expirationTime) {
    var now = new Date();

    const protocolParameters = await this._getProtocolParameter(networkId);

    const slot = parseInt(protocolParameters.slot);
    const duration = parseInt(
      (expirationTime.getTime() - now.getTime()) / 1000,
    );

    const ttl = slot + duration;
    const publicKey = this.privateKey
      .derive(harden(1852)) // purpose
      .derive(harden(1815)) // coin type;
      .derive(harden(0))
      .to_public();

    const paymentKeyHashRaw = publicKey.derive(0).derive(0).to_raw_key().hash();
    const stakeKeyHashRaw = publicKey.derive(2).derive(0).to_raw_key().hash();

    const baseAddr = S.BaseAddress.new(
      networkId,
      S.StakeCredential.from_keyhash(paymentKeyHashRaw),
      S.StakeCredential.from_keyhash(stakeKeyHashRaw),
    );
    // .to_address();
    // const baseAddr = S.BaseAddress.new(
    //     networkId,
    //     S.StakeCredential.from_keyhash(this.utxoPubKey.to_raw_key().hash()),
    //     S.StakeCredential.from_keyhash(this.stakeKey.to_raw_key().hash()),
    //   );

    const paymentKeyHash = baseAddr.payment_cred().to_keyhash();

    const nativeScripts = S.NativeScripts.new();
    const script = S.ScriptPubkey.new(paymentKeyHash);
    const nativeScript = S.NativeScript.new_script_pubkey(script);
    const lockScript = S.NativeScript.new_timelock_expiry(
      S.TimelockExpiry.new(ttl),
    );
    nativeScripts.add(nativeScript);
    nativeScripts.add(lockScript);
    const finalScript = S.NativeScript.new_script_all(
      S.ScriptAll.new(nativeScripts),
    );
    const policyId = Buffer.from(
      S.ScriptHash.from_bytes(finalScript.hash().to_bytes()).to_bytes(),
      'hex',
    ).toString('hex');
    return {
      id: policyId,
      script: Buffer.from(finalScript.to_bytes()).toString('hex'),
      paymentKeyHash: Buffer.from(paymentKeyHash.to_bytes(), 'hex').toString(
        'hex',
      ),
      ttl,
    };
  }
  
  async getAddressUtxos(address, networkId = 1) {
    // console.log('getAddressUtxos')
    let result = []
    const res = await this._blockfrostRequest({
      endpoint: `/addresses/${address}/utxos`,
      networkId: networkId,
      method: 'GET',
    });
    // console.log('res')
    // console.log(res)

    result = result.concat(res)
    if (result.length <= 0) return []
    
    // console.log('converted')
    // console.log(converted)
    
    return result
  }
  async getAddressUtxosHex(address, networkId = 1) {
    const utxos = getAddressUtxos(address, networkId)
    const paymentAddr = Buffer.from(
      S.Address.from_bech32(address).to_bytes(),
      'hex'
    ).toString('hex');
    let converted = await Promise.all(
      utxos.map(async (utxo) => Buffer.from(
        (await this.utxoFromJson(utxo, paymentAddr)).to_bytes(),
        'hex'
      ).toString('hex'))
    );
    return converted
  }

  async utxoToHex(utxo, address){
    const paymentAddr = Buffer.from(
      S.Address.from_bech32(address).to_bytes(),
      'hex'
    ).toString('hex');
    return Buffer.from(
      (await this.utxoFromJson(utxo, paymentAddr)).to_bytes(),
      'hex'
    ).toString('hex')
  }

  async utxoToJson(utxo) {
    const assets = await this.valueToAssets(utxo.output().amount());
    return {
      txHash: Buffer.from(
        utxo.input().transaction_id().to_bytes(),
        'hex'
      ).toString('hex'),
      txId: utxo.input().index(),
      amount: assets,
    };
  };

  async utxoFromJson(output, address) {
    const outHash = output.tx_hash ?  output.tx_hash : output.txHash
    const outIndex = output.output_index ? output.output_index : output.txId
    return S.TransactionUnspentOutput.new(
      S.TransactionInput.new(
        S.TransactionHash.from_bytes(
          Buffer.from(outHash, 'hex')
        ),
        outIndex
      ),
      S.TransactionOutput.new(
        S.Address.from_bytes(Buffer.from(address, 'hex')),
        await this.assetsToValue(output.amount)
      )
    );
  };
  
  async assetsToValue(assets) {
    // await Loader.load();
    const multiAsset = S.MultiAsset.new();
    const lovelace = assets.find((asset) => asset.unit === 'lovelace');
    const policies = [
      ...new Set(
        assets
          .filter((asset) => asset.unit !== 'lovelace')
          .map((asset) => asset.unit.slice(0, 56))
      ),
    ];
    policies.forEach((policy) => {
      const policyAssets = assets.filter(
        (asset) => asset.unit.slice(0, 56) === policy
      );
      const assetsValue = S.Assets.new();
      policyAssets.forEach((asset) => {
        assetsValue.insert(
          S.AssetName.new(Buffer.from(asset.unit.slice(56), 'hex')),
          S.BigNum.from_str(asset.quantity)
        );
      });
      multiAsset.insert(
        S.ScriptHash.from_bytes(Buffer.from(policy, 'hex')),
        assetsValue
      );
    });
    const value = S.Value.new(
      S.BigNum.from_str(lovelace ? lovelace.quantity : '0')
    );
    if (assets.length > 1 || !lovelace) value.set_multiasset(multiAsset);
    return value;
  };

  async decodeTransaction(transactionHex, networkId) {
    const recipients = {};

    const transaction = S.Transaction.from_bytes(
      Buffer.from(transactionHex, 'hex'),
    );

    const transaction_body = transaction.body();
    // get outputs
    console.log("transaction_body.inputs().len");
    console.log(transaction_body.inputs().len());
    console.log("transaction_body.outputs().len");
    console.log(transaction_body.outputs().len());
    const outputs = transaction_body.outputs();

    // get inputs
    const inputs = transaction_body.inputs();

    // check number of outputs
    let txInputs = {};
    for (let inputIndex of [...Array(inputs.len()).keys()]) {
      const input = inputs.get(inputIndex);
      const txIndex = input.index();

      const txHash = Buffer.from(
        input.transaction_id().to_bytes(),
        'hex',
      ).toString('hex');

      const tx = await this._blockfrostRequest({
        endpoint: `/txs/${txHash}/utxos`,
        networkId: networkId,
        method: 'GET',
      });
      const txInput = tx.outputs.filter(
        (row) => row.output_index == txIndex,
      )[0];

      if (typeof txInputs[txInput.address] == 'undefined') {
        txInputs[txInput.address] = {
          amount: 0,
          assets: {},
        };
      }
      
      if(!txInputs[txInput.address].utxoHashes) txInputs[txInput.address].utxoHashes = ''
      txInputs[txInput.address].utxoHashes += `${Buffer.from(input.transaction_id().to_bytes()).toString('hex')}_${input.index()},`

      txInput.amount.map((amount) => {
        if (amount.unit == 'lovelace') {
          txInputs[txInput.address].amount += parseInt(amount.quantity);
        } else {
          let unit =
            amount.unit.slice(0, 56) + '.' + HexToAscii(amount.unit.slice(56));
          if (typeof txInputs[txInput.address].assets[unit] == 'undefined') {
            txInputs[txInput.address].assets[unit] = 0;
          }

          txInputs[txInput.address].assets[unit] =
            txInputs[txInput.address].assets[unit] + parseInt(amount.quantity);
        }
      });
    }

    for (let outputIndex of [...Array(outputs.len()).keys()]) {
      let outputTransaction = outputs.get(outputIndex);
      let outputAddress = outputTransaction.address().to_bech32().toString();
      if (typeof recipients[outputAddress] == 'undefined') {
        recipients[outputAddress] = {
          amount: 0,
          assets: {},
        };
      }

      recipients[outputAddress].amount += parseInt(
        outputTransaction.amount().coin().to_str(),
      );
      if (outputTransaction.amount().multiasset()) {
        let multiAssets = outputTransaction.amount().multiasset();
        let multiAssetKeys = multiAssets.keys();

        for (let assetsKeyIndex of [
          ...Array(multiAssets.keys().len()).keys(),
        ]) {
          let assetsKey = multiAssetKeys.get(assetsKeyIndex);
          let assets = multiAssets.get(assetsKey);
          let assetKeys = assets.keys();
          let policyId = Buffer.from(assetsKey.to_bytes()).toString('hex');
          for (let assetKeyIndex of [...Array(assetKeys.len()).keys()]) {
            let asset = assetKeys.get(assetKeyIndex);
            let assetNum = assets.get(asset);
            let unit =
              policyId +
              '.' +
              HexToAscii(Buffer.from(asset.name()).toString('hex'));

            recipients[outputAddress].assets[unit] = parseInt(
              assetNum.to_str(),
            );
          }
        }
      }
    }

    const auxiliary_data = transaction.auxiliary_data();
    let metadata = {};
    if (auxiliary_data) {
      const _metadata = auxiliary_data.metadata();
      if (_metadata) {
        const metadataKeys = _metadata.keys();

        for (let metadataKeyIndex of [...Array(metadataKeys.len()).keys()]) {
          const metadataKey = metadataKeys.get(metadataKeyIndex);
          const metadataRaw = _metadata.get(metadataKey);
          const metadataJson = JSON.parse(
            S.decode_metadatum_to_json_str(metadataRaw, 0),
          );
          metadata[metadataKey.to_str()] = metadataJson;
        }
      }
    }

    Object.keys(txInputs).map((senderAddress) => {
      if (typeof recipients[senderAddress] !== 'undefined') {
        // console.log("recipients[senderAddress]")
        // console.log(recipients[senderAddress])
        txInputs[senderAddress].amount -= recipients[senderAddress].amount;
        recipients[senderAddress].amount = 0;

        Object.entries(recipients[senderAddress].assets).forEach(
          ([unit, quantity]) => {
            if (typeof txInputs[senderAddress].assets[unit] != 'undefined') {
              txInputs[senderAddress].assets[unit] -= quantity;
              recipients[senderAddress].assets[unit] = 0;
              delete recipients[senderAddress].assets[unit];
              if (txInputs[senderAddress].assets[unit] == 0)
                delete txInputs[senderAddress].assets[unit];
            }
          },
        );
      }
    });

    let inputValue = 0;
    let outputValue = 0;

    const recipientsFinal = [];
    Object.keys(recipients).map((key) => {
      if (
        recipients[key].amount > 0 ||
        Object.keys(recipients[key].assets).length > 0
      )
        recipientsFinal.push({
          address: key,
          ...recipients[key],
        });
    });
    const txInputsFinal = Object.keys(txInputs).map((key) => {
      return {
        address: key,
        ...txInputs[key],
      };
    });

    for (let r of recipientsFinal) {
      outputValue += r.amount;
    }
    for (let s of txInputsFinal) {
      inputValue += s.amount;
    }
    const fee = inputValue - outputValue;

    return [txInputsFinal, recipientsFinal, metadata, fee];
  }

  async transaction({
    PaymentAddress = '',
    recipients = [],
    metadata = null,
    utxosRaw = [],
    networkId = 0,
    ttl = 3600,
    multiSig = false,
  }) {
    let utxos = utxosRaw.map((u) =>
      S.TransactionUnspentOutput.from_bytes(Buffer.from(u, 'hex')),
    );
    let protocolParameter = await this._getProtocolParameter(networkId);
    let mintedAssetsArray = [];
    let outputs = S.TransactionOutputs.new();

    let minting = 0;
    let outputValues = {};
    let costValues = {};
    for (let recipient of recipients) {
      let lovelace = Math.floor((recipient.amount || 0) * 1000000).toString();
      let ReceiveAddress = recipient.address;
      let multiAsset = this._makeMultiAsset(recipient?.assets || []);
      let mintedAssets = this._makeMintedAssets(recipient?.mintedAssets || []);

      let outputValue = S.Value.new(S.BigNum.from_str(lovelace));
      let minAdaMint = S.Value.new(S.BigNum.from_str('0'));

      if ((recipient?.assets || []).length > 0) {
        outputValue.set_multiasset(multiAsset);
        let minAda = S.min_ada_required(
          outputValue,
          S.BigNum.from_str(protocolParameter.minUtxo),
        );

        if (S.BigNum.from_str(lovelace).compare(minAda) < 0)
          outputValue.set_coin(minAda);
      }
      (recipient?.mintedAssets || []).map((asset) => {
        minting += 1;
        mintedAssetsArray.push({
          ...asset,
          address: recipient.address,
        });
      });

      if (parseInt(outputValue.coin().to_str()) > 0) {
        outputValues[recipient.address] = outputValue;
      }
      if ((recipient.mintedAssets || []).length > 0) {
        minAdaMint = S.min_ada_required(
          mintedAssets,
          S.BigNum.from_str(protocolParameter.minUtxo),
        );

        let requiredMintAda = S.Value.new(S.BigNum.from_str('0'));
        requiredMintAda.set_coin(minAdaMint);
        if (outputValue.coin().to_str() == 0) {
          outputValue = requiredMintAda;
        } else {
          outputValue = outputValue.checked_add(requiredMintAda);
        }
      }
      if (ReceiveAddress != PaymentAddress)
        costValues[ReceiveAddress] = outputValue;
      outputValues[ReceiveAddress] = outputValue;
      if (parseInt(outputValue.coin().to_str()) > 0) {
        outputs.add(
          S.TransactionOutput.new(
            S.Address.from_bech32(ReceiveAddress),
            outputValue,
          ),
        );
      }
    }
    let RawTransaction = null;
    if (minting > 0) {
      outputValues[PaymentAddress] = S.Value.new(S.BigNum.from_str('0'));

      RawTransaction = await this._txBuilderMinting({
        PaymentAddress: PaymentAddress,
        Utxos: utxos,
        Outputs: outputs,
        mintedAssetsArray: mintedAssetsArray,
        outputValues: outputValues,
        ProtocolParameter: protocolParameter,
        metadata: metadata,
        multiSig: multiSig,
        ttl: ttl,
        costValues: costValues,
      });
    } else {
      RawTransaction = await this._txBuilder({
        PaymentAddress: PaymentAddress,
        Utxos: utxos,
        Outputs: outputs,
        ProtocolParameter: protocolParameter,
        Metadata: metadata,

        Delegation: null,
      });
    }
    return Buffer.from(RawTransaction, 'hex').toString('hex');
  }
  signTx(txHash) {
    const transaction = S.Transaction.from_bytes(Buffer.from(txHash, 'hex'));

    const transaction_body = transaction.body();

    const txBodyHash = S.hash_transaction(transaction_body);

    const witness = S.make_vkey_witness(
      txBodyHash,
      this.paymentKey.to_raw_key(),
    );
    const witnessSet = S.TransactionWitnessSet.new();
    const vKeys = S.Vkeywitnesses.new();
    vKeys.add(witness);
    witnessSet.set_vkeys(vKeys);

    return Buffer.from(witnessSet.to_bytes(), 'hex').toString('hex');
  }

  async submitTx({
    transactionRaw,
    witnesses,
    scripts,
    networkId,
    metadata = null,
  }) {
    let transaction = S.Transaction.from_bytes(
      Buffer.from(transactionRaw, 'hex'),
    );

    const txWitnesses = transaction.witness_set();
    const txVkeys = txWitnesses.vkeys();
    const txScripts = txWitnesses.native_scripts();
    const totalVkeys = S.Vkeywitnesses.new();
    const totalScripts = S.NativeScripts.new();

    console.log('witnesses');
    console.log(witnesses);
    for (let witness of witnesses) {
      console.log('witness');
      console.log(witness);
      const addWitnesses = S.TransactionWitnessSet.from_bytes(
        Buffer.from(witness, 'hex'),
      );
      console.log('addWitnesses');
      console.log(addWitnesses);
      const addVkeys = addWitnesses.vkeys();
      console.log('addVkeys');
      console.log(addVkeys);
      if (addVkeys) {
        for (let i = 0; i < addVkeys.len(); i++) {
          totalVkeys.add(addVkeys.get(i));
        }
      }
    }

    if (txVkeys) {
      for (let i = 0; i < txVkeys.len(); i++) {
        totalVkeys.add(txVkeys.get(i));
      }
    }
    if (txScripts) {
      for (let i = 0; i < txScripts.len(); i++) {
        totalScripts.add(txScripts.get(i));
      }
    }

    const totalWitnesses = S.TransactionWitnessSet.new();
    totalWitnesses.set_vkeys(totalVkeys);
    totalWitnesses.set_native_scripts(totalScripts);
    let aux;
    if (metadata) {
      aux = S.AuxiliaryData.new();
      const generalMetadata = S.GeneralTransactionMetadata.new();
      Object.entries(metadata).map(([MetadataLabel, Metadata]) => {
        generalMetadata.insert(
          S.BigNum.from_str(MetadataLabel),
          S.encode_json_str_to_metadatum(JSON.stringify(Metadata), 0),
        );
      });

      aux.set_metadata(generalMetadata);
    } else {
      aux = transaction.auxiliary_data();
    }
    const signedTx = await S.Transaction.new(
      transaction.body(),
      totalWitnesses,
      aux,
    );
    const txhash = await this._blockfrostRequest({
      endpoint: `/tx/submit`,
      headers: {
        'Content-Type': 'application/cbor',
      },
      body: Buffer.from(signedTx.to_bytes(), 'hex'),
      networkId: networkId,
      method: 'POST',
    });
    // const txhash = await fetch('https://submit-api.mainnet.dandelion.link/api/submit/tx', {
    //     headers: {
    //         "Content-Type": "application/cbor"
    //     },
    //     body: Buffer.from(signedTx.to_bytes(), "hex"),
    //     method: "POST"
    // })
    return txhash;
  }

  hashMetadata(metadata) {
    let aux = S.AuxiliaryData.new();

    const generalMetadata = S.GeneralTransactionMetadata.new();
    Object.entries(metadata).map(([MetadataLabel, Metadata]) => {
      generalMetadata.insert(
        S.BigNum.from_str(MetadataLabel),
        S.encode_json_str_to_metadatum(JSON.stringify(Metadata), 0),
      );
    });

    aux.set_metadata(generalMetadata);

    const metadataHash = S.hash_auxiliary_data(aux);
    return Buffer.from(metadataHash.to_bytes(), 'hex').toString('hex');
  }

  //////////////////////////////////////////////////

  _makeMintedAssets(mintedAssets) {
    let AssetsMap = {};

    for (let asset of mintedAssets) {
      let assetName = asset.assetName;
      let quantity = asset.quantity;
      if (!Array.isArray(AssetsMap[asset.policyId])) {
        AssetsMap[asset.policyId] = [];
      }
      AssetsMap[asset.policyId].push({
        unit: Buffer.from(assetName, 'ascii').toString('hex'),
        quantity: quantity,
      });
    }
    let multiAsset = S.MultiAsset.new();

    for (const policy in AssetsMap) {
      const ScriptHash = S.ScriptHash.from_bytes(Buffer.from(policy, 'hex'));
      const Assets = S.Assets.new();

      const _assets = AssetsMap[policy];

      for (const asset of _assets) {
        const AssetName = S.AssetName.new(Buffer.from(asset.unit, 'hex'));
        const BigNum = S.BigNum.from_str(asset.quantity);

        Assets.insert(AssetName, BigNum);
      }

      multiAsset.insert(ScriptHash, Assets);
    }
    const value = S.Value.new(S.BigNum.from_str('0'));

    value.set_multiasset(multiAsset);
    return value;
  }

  _makeMultiAsset(assets) {
    let AssetsMap = {};
    for (let asset of assets) {
      let [policy, assetName] = asset.unit.split('.');
      let quantity = asset.quantity;
      if (!Array.isArray(AssetsMap[policy])) {
        AssetsMap[policy] = [];
      }
      AssetsMap[policy].push({
        unit: Buffer.from(assetName, 'ascii').toString('hex'),
        quantity: quantity,
      });
    }

    let multiAsset = S.MultiAsset.new();

    for (const policy in AssetsMap) {
      const ScriptHash = S.ScriptHash.from_bytes(Buffer.from(policy, 'hex'));
      const Assets = S.Assets.new();

      const _assets = AssetsMap[policy];

      for (const asset of _assets) {
        const AssetName = S.AssetName.new(Buffer.from(asset.unit, 'hex'));
        const BigNum = S.BigNum.from_str(asset.quantity.toString());

        Assets.insert(AssetName, BigNum);
      }

      multiAsset.insert(ScriptHash, Assets);
    }

    return multiAsset;
  }

  _utxoToAssets(utxo) {
    let value = utxo.output().amount();
    const assets = [];
    assets.push({
      unit: 'lovelace',
      quantity: value.coin().to_str(),
    });
    if (value.multiasset()) {
      const multiAssets = value.multiasset().keys();
      for (let j = 0; j < multiAssets.len(); j++) {
        const policy = multiAssets.get(j);
        const policyAssets = value.multiasset().get(policy);
        const assetNames = policyAssets.keys();
        for (let k = 0; k < assetNames.len(); k++) {
          const policyAsset = assetNames.get(k);
          const quantity = policyAssets.get(policyAsset);
          const asset =
            Buffer.from(policy.to_bytes()).toString('hex') +
            '.' +
            Buffer.from(policyAsset.name()).toString('ascii');

          assets.push({
            unit: asset,
            quantity: quantity.to_str(),
          });
        }
      }
    }
    return assets;
  }
  async _txBuilderMinting({
    PaymentAddress,
    Utxos,
    Outputs,
    ProtocolParameter,
    mintedAssetsArray = [],

    outputValues = {},
    metadata = null,
    ttl = 3600,
    multiSig = false,
    costValues = {},
  }) {
    const MULTIASSET_SIZE = 5000;
    const VALUE_SIZE = 5000;
    const totalAssets = 0;

    CoinSelection.setProtocolParameters(
      ProtocolParameter.minUtxo.toString(),
      ProtocolParameter.linearFee.minFeeA.toString(),
      ProtocolParameter.linearFee.minFeeB.toString(),
      ProtocolParameter.maxTxSize.toString(),
    );
    const selection = await CoinSelection.randomImprove(
      Utxos,
      Outputs,
      20 + totalAssets,
    );

    const nativeScripts = S.NativeScripts.new();
    let mint = S.Mint.new();

    let mintedAssetsDict = {};
    let assetsDict = {};
    for (let asset of mintedAssetsArray) {
      if (typeof assetsDict[asset.assetName] == 'undefined') {
        assetsDict[asset.assetName] = {};
        assetsDict[asset.assetName].quantity = 0;
        assetsDict[asset.assetName].policyScript = asset.policyScript;
      }
      assetsDict[asset.assetName].quantity =
        assetsDict[asset.assetName].quantity + parseInt(asset.quantity);
    }

    Object.entries(assetsDict).map(([assetName, asset]) => {
      const mintAssets = S.MintAssets.new();
      mintAssets.insert(
        S.AssetName.new(Buffer.from(assetName)),
        S.Int.new(S.BigNum.from_str(asset.quantity.toString())),
      );

      if (typeof mintedAssetsDict[asset.policyScript] == 'undefined') {
        mintedAssetsDict[asset.policyScript] = S.MintAssets.new();
      }
      mintedAssetsDict[asset.policyScript].insert(
        S.AssetName.new(Buffer.from(assetName)),
        S.Int.new(S.BigNum.from_str(asset.quantity.toString())),
      );
    });

    for (let asset of mintedAssetsArray) {
      const multiAsset = S.MultiAsset.new();
      const mintedAssets = S.Assets.new();

      const policyScript = S.NativeScript.from_bytes(
        Buffer.from(asset.policyScript, 'hex'),
      );
      nativeScripts.add(policyScript);

      mintedAssets.insert(
        S.AssetName.new(Buffer.from(asset.assetName)),
        S.BigNum.from_str(asset.quantity.toString()),
      );

      multiAsset.insert(
        S.ScriptHash.from_bytes(
          policyScript.hash(S.ScriptHashNamespace.NativeScript).to_bytes(),
        ),
        mintedAssets,
      );
      const mintedValue = S.Value.new(S.BigNum.from_str('0'));
      mintedValue.set_multiasset(multiAsset);
      if (typeof outputValues[asset.address] == 'undefined') {
        outputValues[asset.address] = S.Value.new(S.BigNum.from_str('0'));
      }
      // if (asset.address != PaymentAddress) {
      //     let minAdaMint = S.min_ada_required(
      //         mintedValue,
      //         S.BigNum.from_str(ProtocolParameter.minUtxo)
      //     );

      //     mintedValue.set_coin(minAdaMint)
      // }
      outputValues[asset.address] =
        outputValues[asset.address].checked_add(mintedValue);
    }

    Object.entries(mintedAssetsDict).map(([policyScriptHex, mintAssets]) => {
      const policyScript = S.NativeScript.from_bytes(
        Buffer.from(policyScriptHex, 'hex'),
      );
      mint.insert(
        S.ScriptHash.from_bytes(
          policyScript.hash(S.ScriptHashNamespace.NativeScript).to_bytes(),
        ),
        mintAssets,
      );
    });

    const inputs = S.TransactionInputs.new();

    selection.input.forEach((utxo) => {
      inputs.add(
        S.TransactionInput.new(
          utxo.input().transaction_id(),
          utxo.input().index(),
        ),
      );
      outputValues[PaymentAddress] = outputValues[PaymentAddress].checked_add(
        utxo.output().amount(),
      );
    });

    const rawOutputs = S.TransactionOutputs.new();

    Object.entries(outputValues).map(([address, value]) => {
      rawOutputs.add(
        S.TransactionOutput.new(S.Address.from_bech32(address), value),
      );
    });

    const fee = S.BigNum.from_str('0');
    const rawTxBody = S.TransactionBody.new(
      inputs,
      rawOutputs,
      fee,
      ttl + ProtocolParameter.slot,
    );
    rawTxBody.set_mint(mint);

    let aux = S.AuxiliaryData.new();

    if (metadata) {
      const generalMetadata = S.GeneralTransactionMetadata.new();
      Object.entries(metadata).map(([MetadataLabel, Metadata]) => {
        generalMetadata.insert(
          S.BigNum.from_str(MetadataLabel),
          S.encode_json_str_to_metadatum(JSON.stringify(Metadata), 0),
        );
      });

      aux.set_metadata(generalMetadata);

      rawTxBody.set_auxiliary_data_hash(S.hash_auxiliary_data(aux));
    }

    rawTxBody.set_auxiliary_data_hash(S.hash_auxiliary_data(aux));
    const witnesses = S.TransactionWitnessSet.new();
    witnesses.set_native_scripts(nativeScripts);

    const dummyVkeyWitness =
      '8258208814c250f40bfc74d6c64f02fc75a54e68a9a8b3736e408d9820a6093d5e38b95840f04a036fa56b180af6537b2bba79cec75191dc47419e1fd8a4a892e7d84b7195348b3989c15f1e7b895c5ccee65a1931615b4bdb8bbbd01e6170db7a6831310c';

    const vkeys = S.Vkeywitnesses.new();
    vkeys.add(S.Vkeywitness.from_bytes(Buffer.from(dummyVkeyWitness, 'hex')));

    vkeys.add(S.Vkeywitness.from_bytes(Buffer.from(dummyVkeyWitness, 'hex')));
    if (multiSig) {
      vkeys.add(S.Vkeywitness.from_bytes(Buffer.from(dummyVkeyWitness, 'hex')));
    }
    witnesses.set_vkeys(vkeys);

    const rawTx = S.Transaction.new(rawTxBody, witnesses, aux);

    let minFee = S.min_fee(
      rawTx,
      S.LinearFee.new(
        S.BigNum.from_str(ProtocolParameter.linearFee.minFeeA),
        S.BigNum.from_str(ProtocolParameter.linearFee.minFeeB),
      ),
    );

    outputValues[PaymentAddress] = outputValues[PaymentAddress].checked_sub(
      S.Value.new(minFee),
    );
    Object.entries(costValues).map(([address, value]) => {
      outputValues[PaymentAddress] =
        outputValues[PaymentAddress].checked_sub(value);
    });

    const outputs = S.TransactionOutputs.new();
    Object.entries(outputValues).map(([address, value]) => {
      outputs.add(
        S.TransactionOutput.new(S.Address.from_bech32(address), value),
      );
    });

    const finalTxBody = S.TransactionBody.new(
      inputs,
      outputs,
      minFee,
      ttl + ProtocolParameter.slot,
    );

    finalTxBody.set_mint(rawTxBody.multiassets());

    finalTxBody.set_auxiliary_data_hash(rawTxBody.auxiliary_data_hash());

    const finalWitnesses = S.TransactionWitnessSet.new();
    finalWitnesses.set_native_scripts(nativeScripts);

    const transaction = S.Transaction.new(
      finalTxBody,
      finalWitnesses,
      rawTx.auxiliary_data(),
    );

    const size = transaction.to_bytes().length * 2;
    if (size > ProtocolParameter.maxTxSize) throw ERROR.TX_TOO_BIG;

    return transaction.to_bytes();
  }
  async _txBuilder({
    PaymentAddress,
    Utxos,
    Outputs,
    ProtocolParameter,

    metadata = null,
  }) {
    const MULTIASSET_SIZE = 5000;
    const VALUE_SIZE = 5000;
    const totalAssets = 0;

    CoinSelection.setProtocolParameters(
      ProtocolParameter.minUtxo.toString(),
      ProtocolParameter.linearFee.minFeeA.toString(),
      ProtocolParameter.linearFee.minFeeB.toString(),
      ProtocolParameter.maxTxSize.toString(),
    );

    const selection = await CoinSelection.randomImprove(
      Utxos,
      Outputs,
      20 + totalAssets,
    );

    const inputs = selection.input;
    const txBuilder = S.TransactionBuilder.new(
      S.LinearFee.new(
        S.BigNum.from_str(ProtocolParameter.linearFee.minFeeA),
        S.BigNum.from_str(ProtocolParameter.linearFee.minFeeB),
      ),
      S.BigNum.from_str(ProtocolParameter.minUtxo.toString()),
      S.BigNum.from_str(ProtocolParameter.poolDeposit.toString()),
      S.BigNum.from_str(ProtocolParameter.keyDeposit.toString()),
      MULTIASSET_SIZE,
      MULTIASSET_SIZE,
    );

    for (let i = 0; i < inputs.length; i++) {
      const utxo = inputs[i];
      txBuilder.add_input(
        utxo.output().address(),
        utxo.input(),
        utxo.output().amount(),
      );
    }

    let AUXILIARY_DATA;
    if (metadata) {
      AUXILIARY_DATA = S.AuxiliaryData.new();
      const generalMetadata = S.GeneralTransactionMetadata.new();
      Object.entries(Metadata).map(([MetadataLabel, Metadata]) => {
        generalMetadata.insert(
          S.BigNum.from_str(MetadataLabel),
          S.encode_json_str_to_metadatum(JSON.stringify(Metadata), 0),
        );
      });

      aux.set_metadata(generalMetadata);

      txBuilder.set_auxiliary_data(AUXILIARY_DATA);
    }

    for (let i = 0; i < Outputs.len(); i++) {
      txBuilder.add_output(Outputs.get(i));
    }

    const change = selection.change;
    const changeMultiAssets = change.multiasset();
    // check if change value is too big for single output
    if (changeMultiAssets && change.to_bytes().length * 2 > VALUE_SIZE) {
      const partialChange = S.Value.new(S.BigNum.from_str('0'));

      const partialMultiAssets = S.MultiAsset.new();
      const policies = changeMultiAssets.keys();
      const makeSplit = () => {
        for (let j = 0; j < changeMultiAssets.len(); j++) {
          const policy = policies.get(j);
          const policyAssets = changeMultiAssets.get(policy);
          const assetNames = policyAssets.keys();
          const assets = S.Assets.new();
          for (let k = 0; k < assetNames.len(); k++) {
            const policyAsset = assetNames.get(k);
            const quantity = policyAssets.get(policyAsset);
            assets.insert(policyAsset, quantity);
            //check size
            const checkMultiAssets = S.MultiAsset.from_bytes(
              partialMultiAssets.to_bytes(),
            );
            checkMultiAssets.insert(policy, assets);
            const checkValue = S.Value.new(S.BigNum.from_str('0'));
            checkValue.set_multiasset(checkMultiAssets);
            if (checkValue.to_bytes().length * 2 >= VALUE_SIZE) {
              partialMultiAssets.insert(policy, assets);
              return;
            }
          }
          partialMultiAssets.insert(policy, assets);
        }
      };

      makeSplit();
      partialChange.set_multiasset(partialMultiAssets);

      const minAda = S.min_ada_required(
        partialChange,
        S.BigNum.from_str(ProtocolParameter.minUtxo),
      );
      partialChange.set_coin(minAda);

      txBuilder.add_output(
        S.TransactionOutput.new(
          S.Address.from_bech32(PaymentAddress),
          partialChange,
        ),
      );
    }
    txBuilder.add_change_if_needed(S.Address.from_bech32(PaymentAddress));
    const transaction = S.Transaction.new(
      txBuilder.build(),
      S.TransactionWitnessSet.new(),
      AUXILIARY_DATA,
    );

    const size = transaction.to_bytes().length * 2;
    if (size > ProtocolParameter.maxTxSize) throw ERROR.TX_TOO_BIG;

    return transaction.to_bytes();
  }

  async _getProtocolParameter(networkId) {
    let latestBlock = await this._blockfrostRequest({
      endpoint: '/blocks/latest',
      networkId: networkId,
      method: 'GET',
    });
    if (!latestBlock) throw ERROR.FAILED_PROTOCOL_PARAMETER;

    let p = await this._blockfrostRequest({
      endpoint: `/epochs/${latestBlock.epoch}/parameters`,
      networkId: networkId,
      method: 'GET',
    }); // if(!p) throw ERROR.FAILED_PROTOCOL_PARAMETER

    return {
      linearFee: {
        minFeeA: p.min_fee_a.toString(),
        minFeeB: p.min_fee_b.toString(),
      },
      minUtxo: '1000000', //p.min_utxo, minUTxOValue protocol paramter has been removed since Alonzo HF. Calulation of minADA works differently now, but 1 minADA still sufficient for now
      poolDeposit: p.pool_deposit,
      keyDeposit: p.key_deposit,
      maxTxSize: p.max_tx_size,
      slot: latestBlock.slot,
    };
  }
  async _submitRequest(body) {
    let latestBlock = await this._blockfrostRequest({
      endpoint: '/blocks/latest',
      network: networkId,
    });
    if (!latestBlock) throw ERROR.FAILED_PROTOCOL_PARAMETER;

    let p = await this._blockfrostRequest({
      endpoint: `/epochs/${latestBlock.epoch}/parameters`,
      networkId: networkId,
    }); //
    if (!p) throw ERROR.FAILED_PROTOCOL_PARAMETER;

    return {
      linearFee: {
        minFeeA: p.min_fee_a.toString(),
        minFeeB: p.min_fee_b.toString(),
      },
      minUtxo: '1000000', //p.min_utxo, minUTxOValue protocol paramter has been removed since Alonzo HF. Calulation of minADA works differently now, but 1 minADA still sufficient for now
      poolDeposit: p.pool_deposit,
      keyDeposit: p.key_deposit,
      maxTxSize: p.max_tx_size,
      slot: latestBlock.slot,
    };
  }
  async _blockfrostRequest({
    body = null,
    endpoint = '',
    networkId = 0,
    headers = {},
    method = 'GET',
  }) {
    let networkEndpoint =
      networkId == 0
        ? 'https://cardano-testnet.blockfrost.io/api/v0'
        : 'https://cardano-mainnet.blockfrost.io/api/v0';
    let blockfrostApiKey = this.getApiKey(networkId);

    try {
      return await (
        await fetch(`${networkEndpoint}${endpoint}`, {
          headers: {
            project_id: blockfrostApiKey,
            ...headers,
          },
          method: method,
          body,
        })
      ).json();
    } catch (error) {
      console.log(error);
      return null;
    }
  }
}
//////////////////////////////////////////////////
//Auxiliary

function AsciiToBuffer(string) {
  return Buffer.from(string, 'ascii');
}

function HexToBuffer(string) {
  return Buffer.from(string, 'hex');
}

function AsciiToHex(string) {
  return AsciiToBuffer(string).toString('hex');
}

function HexToAscii(string) {
  return HexToBuffer(string).toString('ascii');
}

function BufferToAscii(buffer) {
  return buffer.toString('ascii');
}

function BufferToHex(buffer) {
  return buffer.toString('hex');
}

module.exports = {
  CardanoWalletBackend: CardanoWalletBackend,
};
