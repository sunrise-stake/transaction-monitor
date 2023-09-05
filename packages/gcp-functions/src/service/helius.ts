import {GSOL_MINT} from "../libs/constants";
import {getSolBalanceDifferences, getTokenBalanceDifferences} from "../libs/helius";
import {Instruction, TokenBalanceDifference, TransactionInBlock} from "../libs/helius/types";
import {insertTransaction} from "../libs/db";
import {LAMPORTS_PER_SOL, PublicKey} from "@solana/web3.js";

/**
 * Some terminology that is useful here.
 * Two transaction types:
 * Mint: SOL is deposited into the protocol and gSOL is minted. Also known as a deposit
 * Transfer: gSOL is sent from one user to another.
 *
 * Important: It is possible, when minting, to specify a different recipient than yourself. In that case,
 * the transaction is classified as a transfer. In the app (app.sunrisestake.com), there is a
 * function to send funds to anyone including impact organisations. This feature allows users to mint gSOL
 * to these recipients directly rather than first mint and then transfer.
 *
 * A "referrer" is an additional field added to a mint transaction, that specifies that the person minting
 * was referred by someone else, e.g. via a personalised qr code (scan.sunrisestake.com) or some other way.
 */

const SUNRISE_PROGRAM_ID = new PublicKey(
    "sunzv8N3A8dRHwUBvxgRDEbWKk8t7yiHR4FLRgFsTX6"
);
const ACCOUNT_KEY_COUNT_WITH_REFERRER = 21;

const isSunriseIx = (ix: Instruction, accounts: string[]) => ix.programIdIndex === accounts.indexOf(SUNRISE_PROGRAM_ID.toBase58());

const getReferrerFromMint = (heliusTransactionWithMint: TransactionInBlock): PublicKey | undefined => {
    const mintIx = heliusTransactionWithMint.transaction.message.instructions.find(ix => isSunriseIx(ix, heliusTransactionWithMint.transaction.message.accountKeys));
    if (!mintIx) {
        // no mint instruction found - why was this function called?
        return undefined;
    }
    if (mintIx.accounts.length !== ACCOUNT_KEY_COUNT_WITH_REFERRER) {
        // mint instruction does not have a referrer
        return undefined;
    }
    const referrerAccountIndex = mintIx.accounts[ACCOUNT_KEY_COUNT_WITH_REFERRER - 1];
    return new PublicKey(heliusTransactionWithMint.transaction.message.accountKeys[referrerAccountIndex]);
}

const processMintTransaction = (heliusTransaction: TransactionInBlock, balanceDifference: TokenBalanceDifference) => {
    const solDifferences = getSolBalanceDifferences(heliusTransaction);

    // find the address that was reduced by as much sol as the minted gsol
    // there may be fees paid by that address too so the amount is likely to be slightly larger
    const solDifference = solDifferences.find(solDifference => -( solDifference.diff / LAMPORTS_PER_SOL ) >= balanceDifference.diff);

    const from = solDifference ? solDifference.owner : balanceDifference.owner;
    const to = balanceDifference.owner;
    const isDeposit = from.equals(to)

    const referrer = isDeposit ? getReferrerFromMint(heliusTransaction) : undefined;

    return insertTransaction({
        amount: balanceDifference.diff,
        from,
        to,
        signature: heliusTransaction.transaction.signatures[0],
        timestamp: heliusTransaction.blockTime,
        type: isDeposit ? 'MINT' : 'TRANSFER',
        referrer
    })
}

const processTransferTransaction = (heliusTransaction: TransactionInBlock, balanceDifferences: TokenBalanceDifference[]) => {
    const senderDiff = balanceDifferences.find(balanceDifference => balanceDifference.diff < 0);
    const recipientDiff = balanceDifferences.find(balanceDifference => balanceDifference.diff > 0);

    return insertTransaction({
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
        return processMintTransaction(heliusTransaction, gsolBalanceDifferences[0]);
    } else if (gsolBalanceDifferences.length === 2) {
        return processTransferTransaction(heliusTransaction, gsolBalanceDifferences);
    } else {
        throw new Error("Unsupported transaction")
    }
}