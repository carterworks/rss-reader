import { createHash } from "node:crypto";
import type Parser from "rss-parser";

const HASH_ALGORITHM = "sha256";

export function encodeItemLink(link: string): string {
	return createHash(HASH_ALGORITHM).update(link).digest("base64url");
}

export function findLinkByEncodedValue(
	encoded: string,
	feeds: Parser.Output<unknown>[],
): string | undefined {
	for (const feed of feeds) {
		for (const item of feed.items) {
			if (!item.link) {
				continue;
			}

			const candidate = encodeItemLink(item.link);
			if (candidate === encoded) {
				return item.link;
			}
		}
	}

	return undefined;
}
