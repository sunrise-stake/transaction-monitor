import {PublicKey} from "@solana/web3.js";
import {getNetTransfers, getTotalMints, graphLookup} from "../libs/db";
import {AugmentedNeighbourResult, BalanceDetails, NeighbourResult} from "../libs/types";
import {uniqBy} from "../libs/util";

const combine = (mintAmounts: BalanceDetails[], netTransfers: BalanceDetails[]):BalanceDetails[] => {
    const totalAddresses = uniqBy(bd => bd.address, mintAmounts, netTransfers);
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

const augment = async (neighbours: NeighbourResult): Promise<AugmentedNeighbourResult> => {
    const recipients = neighbours.recipientResult.map(entry => new PublicKey(entry._id));
    const senders = neighbours.senderResult.map(entry => new PublicKey(entry._id));

    const dedupedCombinedNeighbours = [...new Set([
        ...recipients,
        ...senders
    ])];

    const balanceDetails = await getBalanceDetails(dedupedCombinedNeighbours);

    return {
        recipientResult: neighbours.recipientResult.map(entry => {
            const balanceDetail = balanceDetails.find(bd => bd.address.toBase58() === entry._id)
            return {
                // TODO these default dates are wrong
                ...(balanceDetail || { address: new PublicKey(entry._id), balance: 0, start: new Date(), end: new Date() }),
                recipients: entry.recipients.map(recipient => new PublicKey(recipient)),
                degree: entry.degree,
            }
        }),
        senderResult: neighbours.senderResult.map(entry => {
            const balanceDetail = balanceDetails.find(bd => bd.address.toBase58() === entry._id)
            return {
                // TODO these default dates are wrong
                ...(balanceDetail || { address: new PublicKey(entry._id), balance: 0, start: new Date(), end: new Date() }),
                senders: entry.senders.map(recipient => new PublicKey(recipient)),
                degree: entry.degree,
            }
        }),
    }
}

export const getNeighbours = async (address: PublicKey, degree?: number): Promise<AugmentedNeighbourResult> => {
    const neighbours = await graphLookup(address, degree);
    return augment(neighbours);
}