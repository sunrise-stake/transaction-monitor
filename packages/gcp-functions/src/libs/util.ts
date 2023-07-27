import {NeighbourResponseEntry} from "./types";
import {PublicKey} from "@solana/web3.js";

export const toPubKeys = (entry: NeighbourResponseEntry) => ({
    sender: new PublicKey(entry.sender),
    recipient: new PublicKey(entry.recipient),
});
export const dedupe = <T>(entries: T[]):T[] => [...new Set(entries)];

export const isNotReflexive = (entry: NeighbourResponseEntry) => entry.sender !== entry.recipient;