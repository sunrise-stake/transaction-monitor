import {GSOL_MINT} from "../libs/constants";
import {getSolBalanceDifferences, getTokenBalanceDifferences} from "../libs/helius";
import {TokenBalanceDifference, TransactionInBlock} from "../libs/helius/types";
import {insertOne} from "../libs/db";
import {LAMPORTS_PER_SOL} from "@solana/web3.js";

const deposit = (heliusTransaction: TransactionInBlock, balanceDifference: TokenBalanceDifference) => {
    const solDifferences = getSolBalanceDifferences(heliusTransaction);

    // find the address that was reduced by as much sol as the minted gsol
    // there may be fees paid by that address too so the amount is likely to be slightly larger
    const solDifference = solDifferences.find(solDifference => -( solDifference.diff / LAMPORTS_PER_SOL ) >= balanceDifference.diff);

    const from = solDifference ? solDifference.owner : balanceDifference.owner;
    const to = balanceDifference.owner;
    const isDeposit = from.equals(to)

    return insertOne({
        amount: balanceDifference.diff,
        from,
        to,
        signature: heliusTransaction.transaction.signatures[0],
        timestamp: heliusTransaction.blockTime,
        type: isDeposit ? 'MINT' : 'TRANSFER'
    })
}

const transfer = (heliusTransaction: TransactionInBlock, balanceDifferences: TokenBalanceDifference[]) => {
    const senderDiff = balanceDifferences.find(balanceDifference => balanceDifference.diff < 0);
    const recipientDiff = balanceDifferences.find(balanceDifference => balanceDifference.diff > 0);

    return insertOne({
        amount: recipientDiff.diff,
        from: senderDiff.owner,
        to: recipientDiff.owner,
        signature: heliusTransaction.transaction.signatures[0],
        timestamp: heliusTransaction.blockTime,
        type: 'TRANSFER'
    });
}

export const processEvent = (heliusTransaction: TransactionInBlock) => {
    const gsolBalanceDifferences = getTokenBalanceDifferences(heliusTransaction, GSOL_MINT);
    if (gsolBalanceDifferences.length === 1) {
        return deposit(heliusTransaction, gsolBalanceDifferences[0]);
    } else if (gsolBalanceDifferences.length === 2) {
        return transfer(heliusTransaction, gsolBalanceDifferences);
    } else {
        throw new Error("Unsupported transaction")
    }
}