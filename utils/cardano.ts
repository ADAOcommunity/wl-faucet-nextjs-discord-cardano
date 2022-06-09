import { Assets, C } from 'lucid-cardano'
import bf from './blockfrost'

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

const decodeTransaction = async (transactionHex: string) => {
    const recipients = {};

    const transaction = C.Transaction.from_bytes(
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
      const input = inputs.get(inputIndex)
      const txIndex = Number(input.index().to_str())

      const txHash = Buffer.from(
        input.transaction_id().to_bytes()
      ).toString('hex')

      const tx = await bf({
        endpoint: `/txs/${txHash}/utxos`,
        method: 'GET'
      })

      const txInput = tx.outputs.filter(
        (row) => row.output_index == txIndex,
      )[0];
      console.log('txInput')
      console.log(txInput)
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
            amount.unit.slice(0, 56) + '.' + Buffer.from(amount.unit.slice(56), 'hex').toString('ascii');
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
              Buffer.from(asset.name()).toString('ascii')

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
            C.decode_metadatum_to_json_str(metadataRaw, 0),
          );
          metadata[metadataKey.to_str()] = metadataJson;
        }
      }
    }

    Object.keys(txInputs).map((senderAddress) => {
      if (typeof recipients[senderAddress] !== 'undefined') {
        txInputs[senderAddress].amount -= recipients[senderAddress].amount;
        recipients[senderAddress].amount = 0;

        Object.entries(recipients[senderAddress].assets).forEach(
          ([unit, quantity]: [unit: string, quantity: number]) => {
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

    return { txInputsFinal, recipientsFinal, metadata, fee }
  }

export { assetsToJsonString, assetsFromJson, decodeTransaction }