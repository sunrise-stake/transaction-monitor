import {PublicKey} from "@solana/web3.js";

type DBTypeSpecificDetails = {
    type: 'MINT',
    referrer: PublicKey | undefined
} | {
    type: 'TRANSFER' | 'BURN' | 'OTHER'
}

export type DBTransaction = {
    from: PublicKey,
    to: PublicKey,
    amount: number,
    signature: string,
    timestamp: number
} & DBTypeSpecificDetails

export type BalanceDetails = {
    address: PublicKey,
    balance: number,
    start: Date,
    end: Date,
}

export type NeighbourResponse = {
    senderResult: NeighbourResponseEntry[],
    recipientResult: NeighbourResponseEntry[],
}

export type NeighbourResponseEntry = {
    sender: string,
    recipient: string,
}

export type AugmentedNeighbourResponse = {
    senderResult: AugmentedNeighbourResponseEntry[],
    recipientResult: AugmentedNeighbourResponseEntry[],
}

export type AugmentedNeighbourResponseEntry = BalanceDetails & {
    sender: PublicKey,
    recipient: PublicKey,
}