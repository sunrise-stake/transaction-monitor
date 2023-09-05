import fetch from "node-fetch";
import {BalanceDetails, DBTransaction, NeighbourResponse} from "./types";
import {logger} from "./logs";
import {PublicKey} from "@solana/web3.js";
import * as dotenv from "dotenv";
dotenv.config();

import {MongoClient, ServerApiVersion} from "mongodb";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
// MongoClient auto-connects so no need to store the connect()
// promise anywhere and reference it.
const client = new MongoClient(process.env.DB_URI, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

const firstAndLastDatePipeline = (recipient: PublicKey) => [
    {
        $match: {
            recipient: recipient.toBase58()
        }
    },
    {
        $group: {
            _id: "$recipient",
            firstDate: { $min: "$timestamp" },
            lastDate: { $max: "$timestamp" }
        }
    },
    {
        $project: {
            _id: 0,
            recipient: '$_id',
            firstDate: 1,
            lastDate: 1
        }
    }
]

export const insertTransaction = (transaction:DBTransaction):Promise<{  status, body: any }> => {
    logger.log({
        message: "Inserting transaction",
        transaction
    });

    const document = {
        signature: transaction.signature,
        timestamp: {$date: {$numberLong: transaction.timestamp + "000"}},
        recipient: transaction.to.toBase58(),
        amount: transaction.amount,
        sender: transaction.from.toBase58()
    }

    if (transaction.type === 'MINT' && transaction.referrer) {
        document['referrer'] = transaction.referrer.toBase58();
    }

    return insertOne(transaction.type === 'MINT' ? 'mints' : 'transfers', document);
}

const datesFromResult = (result: { firstDate: number, lastDate: number }[]):[Date, Date] =>
    result.length === 0 ? null : [
        new Date(result[0].firstDate),
        new Date(result[0].lastDate),
    ]
;

const timedFn = async <T>(fn: () => Promise<T>, name: string): Promise<T> => {
    const start = Date.now();
    const result = await fn();
    const end = Date.now();
    logger.log({message: `Finished ${name} in ${end - start}ms`, severity: "DEBUG"})
    return result;
}

const insertOne = async (collection: string, document: any): Promise<{ status, body: any }> => {
    const result = await client.db('gsol-tracker').collection(collection).insertOne(document);
    return {
        status: result.insertedId ? 200 : 500,
        body: result
    }
}

const aggregate = <T>(collection: string, pipeline: any[]): Promise<T[]> => client.db('gsol-tracker').collection(collection).aggregate<T>(pipeline).toArray()

const timedAggregate = async <T>(collection: string, pipeline: any[], name: string): Promise<T[]> =>
    timedFn(() => aggregate<T>(collection, pipeline), name)

export const getFirstAndLastTransfer = async (address: PublicKey) : Promise<[Date, Date] | null> => {
    const mintResultPromise = timedAggregate<{
        firstDate: number,
        lastDate: number
    }>('mints', firstAndLastDatePipeline(address), 'firstAndLastMint');
    const transferResultPromise = timedAggregate<{
        firstDate: number,
        lastDate: number
    }>('transfers', firstAndLastDatePipeline(address), 'firstAndLastTransfer');

    const mintResult = await mintResultPromise;
    const transferResult = await transferResultPromise;

    const mintDates = datesFromResult(mintResult);
    const transferDates = datesFromResult(transferResult);

    if (mintDates === null) return transferDates
    if (transferDates === null) return mintDates

    const firstDate = mintDates[0].getTime() < transferDates[0].getTime() ? mintDates[0] : transferDates[0]
    const lastDate = mintDates[1].getTime() > transferDates[1].getTime() ? mintDates[1] : transferDates[1]

    return [firstDate, lastDate];
}

export const getTotalMints = async (addresses: PublicKey[]): Promise<BalanceDetails[]> => {
    const addressStrings = addresses.map(a => a.toBase58());
    const aggregationPipeline = [
        {
            $match: {
                recipient: {$in: addressStrings}
            }
        },
        {
            $group: {
                _id: "$recipient",
                totalMintAmount: {$sum: "$amount"},
                earliestMintTimestamp: {$min: "$timestamp"},
                latestMintTimestamp: {$min: "$timestamp"}
            }
        },
        {
            $project: {
                _id: 0,
                recipient: '$_id',
                totalMintAmount: 1,
                earliestMintTimestamp: 1,
                latestMintTimestamp: 1
            }
        }
    ]

    const documents = await timedAggregate<{
        recipient: string,
        totalMintAmount: number,
        earliestMintTimestamp: string,
        latestMintTimestamp: string
    }>('mints', aggregationPipeline, 'totalMints');

    return documents.map(entry => ({
        address: new PublicKey(entry.recipient),
        balance: entry.totalMintAmount,
        start: new Date(Date.parse(entry.earliestMintTimestamp)),
        end: new Date(Date.parse(entry.latestMintTimestamp))
    }));
}

export const getNetTransfers = async (addresses: PublicKey[]): Promise<BalanceDetails[]> => {
    const addressStrings = addresses.map(a => a.toBase58());
    const aggregationPipeline = [
        {
            $match: {
                $or: [
                    { recipient: { $in: addressStrings } },
                    { sender: { $in: addressStrings } }
                ]
            }
        },
        {
            $facet: {
                incoming: [
                    {
                        $match: {
                            recipient: { $in: addressStrings }
                        }
                    },
                    {
                        $group: {
                            _id: "$recipient",
                            totalIncomingTransferAmount: { $sum: "$amount" },
                            earliestIncomingTransferTimestamp: { $min: "$timestamp" },
                            latestIncomingTransferTimestamp: { $min: "$timestamp" }
                        }
                    }
                ],
                outgoing: [
                    {
                        $match: {
                            sender: { $in: addresses }
                        }
                    },
                    {
                        $group: {
                            _id: "$sender",
                            totalOutgoingTransferAmount: { $sum: "$amount" },
                            earliestOutgoingTransferTimestamp: { $min: "$timestamp" },
                            latestOutgoingTransferTimestamp: { $min: "$timestamp" }
                        }
                    }
                ]
            }
        },
        {
            $project: {
                transfers: {
                    $concatArrays: ["$incoming", "$outgoing"]
                }
            }
        },
        { $unwind: "$transfers" },
        {
            $group: {
                _id: "$transfers._id",
                totalIncomingTransferAmount: { $first: "$transfers.totalIncomingTransferAmount" },
                totalOutgoingTransferAmount: { $first: "$transfers.totalOutgoingTransferAmount" },
                earliestIncomingTransferTimestamp: { $first: "$transfers.earliestIncomingTransferTimestamp" },
                earliestOutgoingTransferTimestamp: { $first: "$transfers.earliestOutgoingTransferTimestamp" },
                latestIncomingTransferTimestamp: { $first: "$transfers.latestIncomingTransferTimestamp" },
                latestOutgoingTransferTimestamp: { $first: "$transfers.latestOutgoingTransferTimestamp" }
            }
        },
        {
            $project: {
                _id: 0,
                recipient: '$_id',
                netTransferAmount: { $subtract: [
                        { $ifNull: ["$totalIncomingTransferAmount", 0] },
                        { $ifNull: ["$totalOutgoingTransferAmount", 0] }
                    ] },
                earliestTransferTimestamp: { $min: ["$earliestIncomingTransferTimestamp", "$earliestOutgoingTransferTimestamp"] },
                latestTransferTimestamp: { $min: ["$latestIncomingTransferTimestamp", "$latestOutgoingTransferTimestamp"] }
            }
        }
    ]

    const documents = await timedAggregate<{
        recipient: string,
        netTransferAmount: number,
        earliestTransferTimestamp: string,
        latestTransferTimestamp: string
    }>('transfers', aggregationPipeline, 'netTransfers');

    return documents.map(entry => ({
        address: new PublicKey(entry.recipient),
        balance: entry.netTransferAmount,
        start: new Date(Date.parse(entry.earliestTransferTimestamp)),
        end: new Date(Date.parse(entry.latestTransferTimestamp))
    }));
}

export const getReferrers = async ({from, to}: {
    from?: Date,
    to?: Date
}): Promise<Map<PublicKey, number>> => {
    const matchCondition = {
        referrer: {$exists: true},
    }

    if (from) {
        matchCondition['timestamp.$date.$numberLong'] = {$gte: from.getTime};
    }
    if (to) {
        matchCondition['timestamp.$date.$numberLong'] = {$lte: to.getTime};
    }

    const aggregationPipeline = [
        { $match: matchCondition },
        {
            $group: {
                _id: "$referrer",
                count: {$sum: 1}
            }
        },
        {
            $sort: { count: -1 }
        }
    ]

    const referrerResult = await timedAggregate<{
        _id: string,
        count: number,
    }>('mints', aggregationPipeline, 'referrals');

    return new Map(referrerResult.map(entry => ([
        new PublicKey(entry._id),
        entry.count
    ])));
}

/**
 * Graph Lookups are unavailable on the MongoDB Data API so we use a dedicated Realm function for it.
 * @param address
 * @param degree
 */
export const graphLookup = async (address: PublicKey, degree: number = 2): Promise<NeighbourResponse> => {
    const queryParams =
        `?secret=${process.env.GRAPH_LOOKUP_SECRET}&address=${address.toBase58()}&degree=${degree}`;
    const {status, body} = await fetch(process.env.GRAPH_LOOKUP_URL + queryParams).then(async (res) => ({
        status: res.status,
        body: await res.json()
    }));

    if (status >= 400) throw new Error(`${status} Error retrieving neighbours for ${address}: ` + body);

    return body;
};