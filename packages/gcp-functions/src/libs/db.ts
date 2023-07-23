import fetch from "node-fetch";
import {BalanceDetails, DBTransaction, NeighbourResult} from "./types";
import {logger} from "./logs";
import {PublicKey} from "@solana/web3.js";

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

export const insertOne = (transaction:DBTransaction):Promise<{  status, body: any }> => {
    logger.log({
        message: "Inserting transaction",
        transaction
    });
    return post('insertOne', {
        collection: transaction.type === 'MINT' ? 'mints' : 'transfers',
        document: {
            signature: transaction.signature,
            timestamp: {$date: {$numberLong: transaction.timestamp + "000"}},
            recipient: transaction.to.toBase58(),
            amount: transaction.amount,
            sender: transaction.from.toBase58()
        }
    })
}

const datesFromBody = (result: { body: { documents: { firstDate: number, lastDate: number }[]}}):[Date, Date] =>
    result.body.documents.length === 0 ? null : [
        new Date(result.body.documents[0].firstDate),
        new Date(result.body.documents[0].lastDate),
    ]
;

export const getFirstAndLastTransfer = async (address: PublicKey) : Promise<[Date, Date]> => {
    const mintPromise = post('aggregate', {
        collection: 'mints',
        pipeline: firstAndLastDatePipeline(address)
    });

    const transferPromise = post('aggregate', {
        collection: 'transfers',
        pipeline: firstAndLastDatePipeline(address)
    });

    const mintResult = await mintPromise;
    const transferResult = await transferPromise;

    if (mintResult.status >= 400 || transferResult.status >= 400) {
        throw new Error("Error retrieving first date");
    }

    const mintDates = datesFromBody(mintResult);
    const transferDates = datesFromBody(transferResult);

    if (mintDates === null) return transferDates
    if (transferDates === null) return mintDates

    const firstDate = mintDates[0].getTime() < transferDates[0].getTime() ? mintDates[0] : transferDates[0]
    const lastDate = mintDates[1].getTime() > transferDates[1].getTime() ? mintDates[1] : transferDates[1]

    return [firstDate, lastDate];
}

export const getTotalMints = async (addresses: PublicKey[]): Promise<BalanceDetails[]> => {
    const aggregationPipeline = [
        {
            $match: {
                recipient: {$in: addresses.map(a => a.toBase58())}
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
    console.log(JSON.stringify(aggregationPipeline, null, 2));

    const timestamp = new Date().getTime();
    const { status, body } = await post('aggregate', {
        collection: 'mints',
        pipeline: aggregationPipeline
    });
    console.log(`Total mints took ${new Date().getTime() - timestamp}ms`);

    if (status >= 400) throw new Error("Error retrieving mint total");

    return body.documents.map(entry => ({
        address: new PublicKey(entry.recipient),
        balance: entry.totalMintAmount,
        start: new Date(Date.parse(entry.earliestMintTimestamp)),
        end: new Date(Date.parse(entry.latestMintTimestamp))
    }));
}

export const getNetTransfers = async (addresses: PublicKey[]): Promise<BalanceDetails[]> => {
    const aggregationPipeline = [
        {
            $match: {
                $or: [
                    { recipient: { $in: addresses } },
                    { sender: { $in: addresses } }
                ]
            }
        },
        {
            $facet: {
                incoming: [
                    {
                        $match: {
                            recipient: { $in: addresses }
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

    console.log(JSON.stringify(aggregationPipeline, null, 2));

    const timestamp = new Date().getTime();

    const { status, body } = await post('aggregate', {
        collection: 'transfers',
        pipeline: aggregationPipeline
    });
    console.log(`Net transfers took ${new Date().getTime() - timestamp}ms`);

    if (status >= 400) throw new Error("Error retrieving transfer total");

    return body.documents.map(entry => ({
        address: new PublicKey(entry.recipient),
        balance: entry.netTransferAmount,
        start: new Date(Date.parse(entry.earliestTransferTimestamp)),
        end: new Date(Date.parse(entry.latestTransferTimestamp))
    }));
}

/**
 * Graph Lookups are unavailable on the MongoDB Data API so we use a dedicated Realm function for it.
 * @param address
 * @param degree
 */
export const graphLookup = async (address: PublicKey, degree: number = 2): Promise<NeighbourResult> => {
    const queryParams =
        `?secret=${process.env.GRAPH_LOOKUP_SECRET}&address=${address.toBase58()}&degree=${degree}`;
    const {status, body} = await fetch(process.env.GRAPH_LOOKUP_URL + queryParams).then(async (res) => ({
        status: res.status,
        body: await res.json()
    }));

    if (status >= 400) throw new Error(`${status} Error retrieving neighbours for ${address}: ` + body);

    return body;
};

const post = (action: 'insertOne' | 'aggregate', body: any) =>
    fetch(process.env.DB_URL + action, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'api-key': process.env.DB_KEY,
        },
        body: JSON.stringify({
            dataSource: "Cluster0",
            database: "gsol-tracker",
            ...body
        }),
    }).then(async (res) =>  ({
        status: res.status,
        body: await res.json()
    }));