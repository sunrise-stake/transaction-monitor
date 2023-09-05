import {PublicKey} from "@solana/web3.js";

export interface TransactionInBlock {
    blockTime: number;
    indexWithinBlock: number;
    meta: Meta;
    slot: number;
    transaction: Transaction;
}

interface Meta {
    err: null;
    fee: number;
    innerInstructions: InnerInstruction[];
    loadedAddresses: LoadedAddresses;
    logMessages: string[];
    postBalances: number[];
    postTokenBalances: PostTokenBalance[];
    preBalances: number[];
    preTokenBalances: PreTokenBalance[];
    rewards: any[];
}

interface InnerInstruction {
    index: number;
    instructions: Instruction[];
}

export interface Instruction {
    accounts: number[];
    data: string;
    programIdIndex: number;
}

interface LoadedAddresses {
    readonly: any[];
    writable: any[];
}

interface PostTokenBalance {
    accountIndex: number;
    mint: string;
    owner: string;
    programId: string;
    uiTokenAmount: UiTokenAmount;
}

interface PreTokenBalance {
    accountIndex: number;
    mint: string;
    owner: string;
    programId: string;
    uiTokenAmount: UiTokenAmount;
}

interface UiTokenAmount {
    amount: string;
    decimals: number;
    uiAmount: number;
    uiAmountString: string;
}

interface Transaction {
    message: Message;
    signatures: string[];
}

interface Message {
    accountKeys: string[];
    header: Header;
    instructions: Instruction[];
    recentBlockhash: string;
}

interface Header {
    numReadonlySignedAccounts: number;
    numReadonlyUnsignedAccounts: number;
    numRequiredSignatures: number;
}

export type BalanceDifference = {
    owner: PublicKey;
    diff: number;
}

export type TokenBalanceDifference = BalanceDifference & {
    mint: PublicKey;
}