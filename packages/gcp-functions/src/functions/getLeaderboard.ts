import {logger} from "../libs/logs";
import {HttpFunction} from "@google-cloud/functions-framework";
import {getLeaderboard} from "../service/leaderboard";

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

    const { params } = req;

    logger.log({message: "Getting leaderboard", params, severity: "DEBUG"});

    const from = params.from ? new Date(parseInt(params.from)) : undefined;
    const to = params.to ? new Date(parseInt(params.to)) : undefined;

    const leaderboard = await getLeaderboard(from, to);
    const leaderboardView: Record<string, number> = Object.fromEntries(leaderboard.entries());

    logger.log({message: "Leaderboard", leaderboardView, severity: "DEBUG"});

    res.status(200).send({ leaderboard: leaderboardView });
}