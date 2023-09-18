import {PublicKey} from "@solana/web3.js";
import {BalanceDifference, TokenBalanceDifference, TransactionInBlock} from "./types";

export const parseTransaction = (json: string): TransactionInBlock => {
    return JSON.parse(json) as TransactionInBlock;
}

const GSOL_DECIMALS = 9

const stringDiff = (a: string, b: string, decimals: number): number => {
    const diff = BigInt(a) - BigInt(b)
    return Number(diff) / (10 ** decimals)
}

export const getTokenBalanceDifferences = (transaction: TransactionInBlock, mint: PublicKey): TokenBalanceDifference[] =>
    transaction.meta.postTokenBalances
        .filter(postTokenBalance => postTokenBalance.mint === mint.toBase58())
        .map((postTokenBalance) => {
            let preTokenBalance = transaction.meta.preTokenBalances.find(
                preTokenBalance => preTokenBalance.owner === postTokenBalance.owner && preTokenBalance.mint === postTokenBalance.mint
            );
            if (!preTokenBalance) {
                // default to 0 if no pre-balance found
                preTokenBalance = {
                    ...postTokenBalance,
                    uiTokenAmount: {
                        amount: "0",
                        uiAmount: 0,
                        uiAmountString: "0",
                        decimals: postTokenBalance.uiTokenAmount.decimals
                    }
                }
            }
            return {
                mint,
                owner: new PublicKey(preTokenBalance.owner),
                diff: stringDiff(postTokenBalance.uiTokenAmount.amount, preTokenBalance.uiTokenAmount.amount, GSOL_DECIMALS)
            }
        })

export const getSolBalanceDifferences = (transaction: TransactionInBlock): BalanceDifference[] =>
    transaction.meta.preBalances
        .map((preBalance, index) => {
            const postBalance = transaction.meta.postBalances[index];
            return {
                owner: new PublicKey(transaction.transaction.message.accountKeys[index]),
                diff: postBalance - preBalance
            }
        })