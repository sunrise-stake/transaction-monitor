import {logger} from "../libs/logs";
import {HttpFunction} from "@google-cloud/functions-framework";
import {PublicKey} from "@solana/web3.js";
import {getFirstAndLastTransfer} from "../libs/db";
import {getNeighbours} from "../service/forest";

export const handler: HttpFunction = async (req, res) => {
    res.set('Access-Control-Allow-Origin', "*")
    res.set('Access-Control-Allow-Methods', 'GET');

    if (req.method === "OPTIONS") {
        // stop preflight requests here
        res.status(204).send('');
        return;
    }
    if (req.method !== "GET") {
        // only GET is allowed
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
}