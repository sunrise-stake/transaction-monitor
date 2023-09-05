import * as functions from "@google-cloud/functions-framework";

import * as dotenv from "dotenv";
dotenv.config();

import {handler as handleTransaction} from "./functions/handleTransaction";
import {handler as getNeighbours} from "./functions/getNeighbours";
import {handler as getLeaderboard} from "./functions/getLeaderboard";

functions.http('handleTransaction', handleTransaction);
functions.http('getNeighbours', getNeighbours);
functions.http('getLeaderboard', getLeaderboard);

