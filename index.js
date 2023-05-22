const functions = require('@google-cloud/functions-framework');

// Simple Google Cloud Function 
functions.http('transactionMonitor', (req, res) => {
    try {

        //Helius sends the raw transaction data as plain strings
        //normal web3 data types like PublicKey are not defined
        //Property names are still the same
        const transactionData = req.body[0];

        //gsol Nft mint https://coinablepay.com/@panasea/8tc66yukfV5EdPxJENBMjd as example
        //check for matching address table lookup key in tx
        //Potentially look to match PDA as more transaction types are added
        if (transactionData.transaction.message.addressTableLookups[0].accountKey === "5BRHZNLvpPpvTavinVwJkh7t7Vof57qVY1E9fffvUmfV") {

            //pull tx data into cleaner variables
            const timestamp = transactionData.blockTime;
            const signature = transactionData.transaction.signatures[0];

            //first object in the post token balances array will always be for the minted token
            const mintedTokenInfo = transactionData.meta.postTokenBalances[0];
            const mintedTokenAddress = mintedTokenInfo.mint;
            const mintOwner = mintedTokenInfo.owner;

            //mintedTokenInfo will have the index of the token account for the accountKeys array
            const mintedTokenAccount = transactionData.transaction.message.accountKeys[mintedTokenInfo.accountIndex];

            //gsol changes
            const gsolPreMint = transactionData.meta.preTokenBalances[0].uiTokenAmount.uiAmount;
            const gsolPostMint = transactionData.meta.postTokenBalances[1].uiTokenAmount.uiAmount;
            const mintPrice = gsolPreMint - gsolPostMint;

            //////////////////
            //add POST to DB//
            //////////////////

            //other txs are for transfers of gsol. not sure what to match for here
        } else {

            //pull tx data into cleaner variables
            const timestamp = transactionData.blockTime;
            const signature = transactionData.transaction.signatures[0];

            //find post gsol token account info
            const postGsolInfo = transactionData.meta.postTokenBalances.filter(account => {
                if (account.mint !== "gso1xA56hacfgTHTF4F7wN5r4jbnJsKh99vR595uybA") {
                    return false;
                }
            });

            //find pre gsol token account info
            const preGsolInfo = transactionData.meta.preTokenBalances.filter(account => {
                if (account.mint !== "gso1xA56hacfgTHTF4F7wN5r4jbnJsKh99vR595uybA") {
                    return false;
                }
            });



            //Check if keys are included in the transaction message or pulled from a lookup table
            const accountKeysLength = transactionData.transaction.message.accountKeys.length;
            let parsedData = [];

            postGsolInfo.forEach(ele => {

                // get the tokenAccount key from the key arrays
                const tokenAccountKey = accountKeysLength > ele.accountIndex ?
                    transactionData.meta.loadedAddresses[ele.accountIndex - accountKeysLength] :
                    transactionData.transaction.message.accountKeys[ele.accountIndex];

                let preAccountData = preGsolInfo.find(preData => preData.accountIndex === ele.accountIndex);

                //if no prebalance data is found, assume account was funded
                if (!preAccountData) {
                    parsedData.push({
                        owner: ele.owner,
                        recipient: tokenAccountKey,
                        amount: ele.uiTokenAmount.uiAmount
                    });

                    //if prebalance is > post account was a sender   
                } else if (preAccountData.uiTokenAmount.uiAmount > ele.uiTokenAmount.uiAmount) {
                    parsedData.push({
                        owner: ele.owner,
                        sender: tokenAccountKey,
                        amount: preAccountData.uiTokenAmount.uiAmount - ele.uiTokenAmount.uiAmount
                    });

                    //if not account was a recipient
                } else if (preAccountData.uiTokenAmount.uiAmount < ele.uiTokenAmount.uiAmount) {
                    parsedData.push({
                        owner: ele.owner,
                        recipient: tokenAccountKey,
                        amount: ele.uiTokenAmount.uiAmount - preAccountData.uiTokenAmount.uiAmount
                    });

                }
            })

            //////////////////
            //add POST to DB//
            //////////////////

        }

        //Check Transactions from the sunrise program and see what will need to be added

        res.status(200).send({ message: 'Complete' });
    } catch (error) {
        console.log(error);
        res.status(500).send({ message: 'Error Parsing Data' });
    }

});
