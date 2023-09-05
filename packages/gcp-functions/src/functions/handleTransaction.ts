import {logger} from "../libs/logs";
import {processEvent} from "../service/helius";
import {HttpFunction} from "@google-cloud/functions-framework";

export const handler: HttpFunction = async (req, res) => {
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
}