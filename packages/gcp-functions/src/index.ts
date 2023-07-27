import * as functions from "@google-cloud/functions-framework";
import {logger} from "./libs/logs";
import {processEvent} from "./service/helius";

import * as dotenv from "dotenv";
dotenv.config();

import {PublicKey} from "@solana/web3.js";
import {getNeighbours} from "./service/forest";
import {getFirstAndLastTransfer} from "./libs/db";

functions.http('handleTransaction', async (req, res) => {
    const { body, headers } = req;
    logger.log({message: "Processing request", body, headers, severity: "DEBUG"})

    // check auth header matches
    if (headers.authorization !== `${process.env.HELIUS_KEY}`) {
        logger.log({message: "Invalid auth header", severity: "WARNING"})
        res.status(401).send('');
        return;
    }

    res.set('Access-Control-Allow-Origin', "*")
    res.set('Access-Control-Allow-Methods', 'POST');

    if (req.method === "OPTIONS") {
        // stop preflight requests here
        res.status(204).send('');
        return;
    }
    if (req.method !== "POST") {
        // only POST is allowed
        res.status(404).send('');
        return;
    }

    try {
        const result = await processEvent(body[0]);
        res.status(200).send({ dbResult: result});
    } catch (error) {
        logger.log({message: "Error processing request", error, severity: "WARNING"})
        // sending 200 anyway to prevent webhooks from being unsubscribed
        res.status(200).send({ error });
    }
});

functions.http('getNeighbours', async (req, res) => {
    res.set('Access-Control-Allow-Origin', "*")
    res.set('Access-Control-Allow-Methods', 'GET');

    if (req.method === "OPTIONS") {
        // stop preflight requests here
        res.status(204).send('');
        return;
    }
    if (req.method !== "GET") {
        // only POST is allowed
        res.status(404).send('');
        return;
    }

    const { path, params } = req;

    // the last element of the path is the address
    const parts = path.split("/");

    const address = parts[parts.length - 1];
    const degree = params.degree ? parseInt(params.degree) : undefined;

    logger.log({message: "Getting neighbours", address, degree: params.degree, severity: "DEBUG"});

    const publicKey = new PublicKey(address);

    const firstAndLastTransferPromise = getFirstAndLastTransfer(publicKey);
    const neighboursPromise = getNeighbours(publicKey, degree);

    const firstAndLastTransfer = await firstAndLastTransferPromise;
    const neighbours = await neighboursPromise;

    const firstTransfer = firstAndLastTransfer ? firstAndLastTransfer[0].getTime() : null;
    const lastTransfer = firstAndLastTransfer ? firstAndLastTransfer[1].getTime() : null;

    res.status(200).send({ neighbours, firstTransfer, lastTransfer });
});