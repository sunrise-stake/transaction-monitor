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
    transaction.meta.preTokenBalances
        .filter(preTokenBalance => preTokenBalance.mint === mint.toBase58())
        .map((preTokenBalance) => {
            const postTokenBalance = transaction.meta.postTokenBalances.find(
                postTokenBalance => postTokenBalance.owner === preTokenBalance.owner && postTokenBalance.mint === preTokenBalance.mint
            );
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