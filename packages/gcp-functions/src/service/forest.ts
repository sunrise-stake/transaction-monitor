import {PublicKey} from "@solana/web3.js";
import {getNetTransfers, getTotalMints, graphLookup} from "../libs/db";
import {
    AugmentedNeighbourResponse,
    BalanceDetails,
    NeighbourResponse,
} from "../libs/types";
import {dedupe, isNotReflexive, toPubKeys} from "../libs/util";

const combine = (mintAmounts: BalanceDetails[], netTransfers: BalanceDetails[]):BalanceDetails[] => {
    const totalAddresses = dedupe([...mintAmounts, ...netTransfers].map(bd => bd.address));
    return totalAddresses.map(address => {
        const mintAmount = mintAmounts.find(ma => ma.address.equals(address));
        const netTransfer = netTransfers.find(nt => nt.address.equals(address));

        if (!mintAmount && !netTransfer) {
            console.warn("NO DATA FOUND FOR " + address);
        }

        if (!mintAmount) return netTransfer;
        if (!netTransfer) return mintAmount;

        return {
            address: mintAmount.address,
            balance: mintAmount.balance + netTransfer.balance,
            start: mintAmount.start.getTime() < netTransfer.start.getTime() ? mintAmount.start : netTransfer.start,
            end: mintAmount.end.getTime() > netTransfer.end.getTime() ? mintAmount.end : netTransfer.end
        }
    })
}

const getBalanceDetails = async (addresses: PublicKey[]): Promise<BalanceDetails[]> => {
    const mintAmountPromise = getTotalMints(addresses);
    const netTransferPromise = getNetTransfers(addresses);

    const mintAmounts = await mintAmountPromise;
    const netTransfers = await netTransferPromise;

    return combine(mintAmounts, netTransfers);
}

const augment = async (neighbours: NeighbourResponse): Promise<AugmentedNeighbourResponse> => {
    const senders = dedupe(neighbours.senderResult).filter(isNotReflexive).map(toPubKeys);
    const recipients = dedupe(neighbours.recipientResult).filter(isNotReflexive).map(toPubKeys);

    const neighbourKeys = dedupe([
        ...neighbours.senderResult.map(s => s.recipient),
        ...neighbours.recipientResult.map(r => r.sender),
    ]).map(nk => new PublicKey(nk));
    const balanceDetails = await getBalanceDetails(neighbourKeys);

    return {
        recipientResult: recipients.map(entry => {
            // TODO optimise into a map
            const balanceDetail = balanceDetails.find(bd => bd.address.equals(entry.sender))
            if (!balanceDetail) {
                // It is not clear why this happens, but if a balance detail cannot be found,
                // filter them out of the result to avoid downstream issues
                console.warn("NO BALANCE DETAIL FOUND FOR " + entry.sender.toBase58());
                return null;
            }
            return {
                // TODO these default dates are wrong
                ...balanceDetail,
                ...entry
            }
        }).filter(e => e !== null),
        senderResult: senders.map(entry => {
            // TODO optimise into a map
            const balanceDetail = balanceDetails.find(bd => bd.address.equals(entry.recipient))
            if (!balanceDetail) {
                // It is not clear why this happens, but if a balance detail cannot be found,
                // filter them out of the result to avoid downstream issues
                console.warn("NO BALANCE DETAIL FOUND FOR " + entry.recipient.toBase58());
                return null;
            }
            return {
                // TODO these default dates are wrong
                ...balanceDetail,
                ...entry
            }
        }).filter(e => e !== null),
    }
}

export const getNeighbours = async (address: PublicKey, degree?: number): Promise<AugmentedNeighbourResponse> => {
    const neighbours = await graphLookup(address, degree);
    return augment(neighbours);
}