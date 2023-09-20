import {beforeAll, describe, expect, it, vi} from 'vitest';
import * as mongodb from 'mongodb';

import { handler } from '../src/graphLookupV2';

const MongoClient = mongodb.MongoClient;
const uri = process.env.VITE_DB_URI;
const client = new MongoClient(uri);

describe('Lookup', () => {
    let handle: any;

    beforeAll(async () => {
        await client.connect();
        handle = handler(client);
    });

    it('should find neighbours for a known address with senders', async () => {
        const address = "Ht3qaFBFpRsB2GSvSAoNBj8DwwexQbp2yzNAR3NfXmE7";
        const { senderResult, recipientResult } = await handle({
            query: {
                address,
                degree: 2
            }
        })

        const senderTree = await senderResult.toArray();
        const recipientTree = await recipientResult.toArray();

        console.log({senders: senderTree, recipients: recipientTree});

        // this address has not sent anything to anyone
        expect(senderTree.length).toBe(0);
        // this address has received funds from other addresses
        expect(recipientTree.length).toBeGreaterThan(0);
    });

    it('should find direct neighbours only', async () => {
        const address = "Ht3qaFBFpRsB2GSvSAoNBj8DwwexQbp2yzNAR3NfXmE7";
        const { senderResult, recipientResult } = await handle({
            query: {
                address,
                degree: 0
            }
        })

        const senderTree = await senderResult.toArray();
        const recipientTree = await recipientResult.toArray();

        console.log({senders: senderTree, recipients: recipientTree});

        // this address has not sent anything to anyone
        expect(senderTree.length).toBe(0);
        // this address has received funds from other addresses
        expect(recipientTree.length).toBe(1);
    });

    it('should find no neighbours for a new address', async () => {
        const address = "HXbZ6hrTBUXCfyuHPb4bCJiCx6XCiTH8gbeBZF5T7qtS"; // an unused address
        const { senderResult, recipientResult } = await handle({
            query: {
                address,
                degree: 2
            }
        })

        const senderTree = await senderResult.toArray();
        const recipientTree = await recipientResult.toArray();

        expect(senderTree.length).toBe(0)
        expect(recipientTree.length).toBe(0);
    });

});