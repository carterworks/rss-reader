import Parser from "rss-parser";

export interface FeedDataResult {
	/** The URLs of the feeds that were fetched */
	sources: string[];
	/** Successfully parsed feeds */
	feeds: Parser.Output<unknown>[];
	/** Any errors encountered while fetching/parsing feeds */
	errors: Error[];
}

let cachedFeedPromise: Promise<FeedDataResult> | undefined;

function getFeedUrls(): string[] {
	const feedsEnv: string = import.meta.env.FEEDS ?? ("" satisfies string);
	return feedsEnv
		.split(/\s*,\s*/)
		.map((url) => url.trim())
		.filter((url) => url.length > 0);
}

/** Utility type guard for Promise.allSettled */
function isFulfilled<T>(
	result: PromiseSettledResult<T>,
): result is PromiseFulfilledResult<T> {
	return result.status === "fulfilled";
}

async function getFeed(): Promise<FeedDataResult> {
	const feedUrls = getFeedUrls();

	const parser = new Parser();
	const feedPromises = feedUrls.map(async (feedUrl) => {
		try {
			const feed = await parser.parseURL(feedUrl);
			return feed;
		} catch (e) {
			let err: Error;
			if (typeof e === "string") {
				err = new Error(e);
			} else if (!(e instanceof Error)) {
				err = new Error(`${e}`);
			} else {
				err = e;
			}
			err.message = `[${feedUrl}] ${err.message ?? e}`;
			throw err;
		}
	});

	const results = await Promise.allSettled(feedPromises);
	const feeds = results.filter(isFulfilled).map((r) => r.value);
	const errors = results
		.filter((r): r is PromiseRejectedResult => r.status === "rejected")
		.map((r) => r.reason as Error);

	return {
		sources: feedUrls,
		feeds,
		errors,
	} satisfies FeedDataResult;
}

/**
 * Fetches and parses all external RSS/Atom feeds defined in the FEEDS env var.
 *
 * The heavy network + parsing work is executed only once thanks to module-level
 * caching. Subsequent invocations during the same build/server runtime will
 * reuse the first Promise.
 */
export function fetchFeedData(): Promise<FeedDataResult> {
	if (!cachedFeedPromise) {
		cachedFeedPromise = getFeed();
	}
	return cachedFeedPromise;
}
