import {getReferrers} from "../libs/db";

export const getLeaderboard = (from?: Date, to?: Date) => getReferrers({from, to})