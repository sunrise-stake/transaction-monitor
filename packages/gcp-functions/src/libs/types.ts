import {PublicKey} from "@solana/web3.js";

export type DBTransaction = {
    from: PublicKey,
    to: PublicKey,
    amount: number,
    signature: string,
    timestamp: number
    type: 'MINT' | 'TRANSFER' | 'BURN' | 'OTHER'
}
export type NeighbourResult = {
    senderResult: {
        _id: string,
        senders: string[],
        degree: number
    }[],
    recipientResult: {
        _id: string,
        recipients: string[],
        degree: number
    }[]
}

export type BalanceDetails = {
    address: PublicKey,
    balance: number,
    start: Date,
    end: Date,
}

export type AugmentedNeighbourResult = {
    senderResult: (BalanceDetails & {
        senders: PublicKey[],
        degree: number
    })[],
    recipientResult: (BalanceDetails & {
        recipients: PublicKey[],
        degree: number
    })[]
}