const senderPipeline = (address, degree) => ([
    {
        $match: {
            sender: address
        }
    },
    ...(degree > 0 ? [
        {
            $unionWith: {
                coll: "transfers",
                pipeline: [
                    { $match: { sender: address } },
                    // Union with mints collection
                    {
                        $unionWith: {
                            coll: "mints",
                            pipeline: [
                                { $match: { referrer: address } },
                                {
                                    $project: {
                                        sender: "$referrer", // Treat referrer as "sender" for a unified view
                                        recipient: 1
                                    }
                                }
                            ]
                        }
                    },
                    // Perform graphLookup on combined view
                    {
                        $graphLookup: {
                            from: "transfers",
                            startWith: "$recipient",
                            connectFromField: "recipient",
                            connectToField: "sender",
                            as: "linked_docs",
                            maxDepth: degree - 1,
                            depthField: "degree"
                        }
                    },
                    { $unwind: "$linked_docs" },
                    {
                        $replaceRoot: { newRoot: "$linked_docs" }
                    },
                    {
                        $project: {
                            _id: 0,
                            sender: 1,
                            recipient: 1,
                            degree: 1
                        }
                    }
                ]
            }
        },
    ] : []),
    // Incorporating direct connections again
    {
        $unionWith: {
            coll: "mints",
            pipeline: [
                {
                    $match: {
                        referrer: address
                    }
                },
                {
                    $project: {
                        sender: "$referrer",
                        recipient: 1,
                        degree: { $literal: 0 }
                    }
                }
            ]
        }
    },
    {
        $group: {
            _id: { sender: "$sender", recipient: "$recipient" },
            degree: { $min: "$degree" }
        }
    },
    {
        $project: {
            sender: "$_id.sender",
            recipient: "$_id.recipient",
            degree: 1,
            _id: 0
        }
    },
    {
        $addFields: {
            degree: {
                $cond: {
                    if: { $eq: ["$degree", null] },
                    then: 0,
                    else: { $add: ["$degree", 1] }
                }
            }
        }
    }
]);

const recipientPipeline = (address, degree) => ([
    {
        $match: {
            recipient: address
        }
    },
    ...(degree > 0 ? [{
        $unionWith: {
            coll: "transfers",
            pipeline: [
                { $match: { recipient: address } },
                // Union with mints collection
                {
                    $unionWith: {
                        coll: "mints",
                        pipeline: [
                            { $match: { recipient: address } },
                            {
                                $project: {
                                    sender: "$referrer", // Treat referrer as "sender" for a unified view
                                    recipient: 1
                                }
                            }
                        ]
                    }
                },
                // Perform graphLookup on combined view
                {
                    $graphLookup: {
                        from: "transfers", // This is not a mistake; even though we've merged data, the lookup is still on the "transfers" collection due to how MongoDB handles $graphLookup
                        startWith: "$sender",
                        connectFromField: "sender",
                        connectToField: "recipient",
                        as: "linked_docs",
                        maxDepth: degree - 1,
                        depthField: "degree"
                    }
                },
                { $unwind: "$linked_docs" },
                {
                    $replaceRoot: { newRoot: "$linked_docs" }
                },
                {
                    $project: {
                        _id: 0,
                        sender: 1,
                        recipient: 1,
                        degree: 1
                    }
                }
            ]
        }
    }] : []),
    // Incorporating direct connections again
    {
        $unionWith: {
            coll: "mints",
            pipeline: [
                {
                    $match: {
                        recipient: address,
                        referrer: { $exists: true }
                    }
                },
                {
                    $project: {
                        sender: "$referrer",
                        recipient: 1,
                        degree: { $literal: 0 }
                    }
                }
            ]
        }
    },
    {
        $group: {
            _id: { sender: "$sender", recipient: "$recipient" },
            degree: { $min: "$degree" }
        }
    },
    {
        $project: {
            sender: "$_id.sender",
            recipient: "$_id.recipient",
            degree: 1,
            _id: 0
        }
    },
    {
        $addFields: {
            degree: {
                $cond: {
                    if: { $eq: ["$degree", null] },
                    then: 0,
                    else: { $add: ["$degree", 1] }
                }
            }
        }
    }
]);

export const handler = (client) => async (request) => {
    let dbName = "gsol-tracker";

    // Get a collection from the context
    // @ts-ignore
    const transfersCollection = client.db(dbName).collection("transfers");

    const address = request.query.address;
    const degree = Number(request.query.degree ?? 2);

    const MAX_DEGREE = 6;
    if (degree > MAX_DEGREE) throw new Error(`Degree cannot be greater than ${MAX_DEGREE}`);

    let senderResult;
    let recipientResult;
    try {
        const senderResultPromise = transfersCollection.aggregate(senderPipeline(address, degree), { maxTimeMS: 60000, allowDiskUse: true });
        const recipientResultPromise = transfersCollection.aggregate(recipientPipeline(address, degree), { maxTimeMS: 60000, allowDiskUse: true });

        senderResult = await senderResultPromise;
        recipientResult = await recipientResultPromise;
    } catch(err) {
        console.log("Error occurred while executing queries:", err.message);
        return { error: err.message };
    }

    return { senderResult, recipientResult };
}

// used by mongo realms
exports = async function(request){
    let serviceName = "mongodb-atlas";
    // @ts-ignore
    return handler(context.services.get(serviceName))(request);
};