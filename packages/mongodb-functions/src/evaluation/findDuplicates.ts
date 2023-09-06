/**
 * A script to find duplicate documents in a collection (duplicates are defined
 * as having the same sender and receiver as some other document).
 */

import { senderResult, recipientResult } from "../../test/fixtures/graphLookupV1.json";

type Document = {
    sender: string,
    recipient: string,
}

const countDuplicates = (result: Document[]): number => {
    const uniques = result.reduce((acc, doc) => {
        const existing = acc.find((d) => d.sender === doc.sender && d.recipient === doc.recipient);
        if (!existing) {
            return [...acc, doc];
        } else return acc;
    }, [] as Document[]);

    return result.length - uniques.length;
}

const senderDuplicates = countDuplicates(senderResult);
const recipientDuplicates = countDuplicates(recipientResult);

console.log(`Found ${senderDuplicates} sender duplicates`);
console.log(`Found ${recipientDuplicates} recipient duplicates`);