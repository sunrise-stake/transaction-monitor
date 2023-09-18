import {processEvent} from "../src/service/helius";
import { describe, it } from 'vitest';

const mintWithComputeBudget = require('./fixtures/helius_messages/raw/deposit2.json');

describe('processEvent', () => {
    describe('mint', () => {
        it('should handle a mint transaction with computeBudget included', async () => {
            const result = await processEvent(mintWithComputeBudget);
        })
    })
});