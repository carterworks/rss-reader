import Parser from "rss-parser";

export interface FeedSourceResult {
	/** The URL of the feed */
	url: string;
	/** Successfully parsed feed, if available */
	feed?: Parser.Output<unknown>;
	/** Any error encountered while fetching/parsing this feed */
	error?: Error;
}

export interface FeedDataResult {
	/** The URLs of the feeds that were fetched */
	sources: FeedSourceResult[];
	/** Successfully parsed feeds */
	feeds: Parser.Output<unknown>[];
	/** Any errors encountered while fetching/parsing feeds */
	errors: Error[];
}

let cachedFeedPromise: Promise<FeedDataResult> | undefined;

function removeStyleTags(html: string): string {
	// Remove <style>...</style> blocks (case-insensitive, across newlines)
	return html.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");
}

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

function grokFeedItem(item: Parser.Item): Parser.Item {
	const hostname = item.link ? new URL(item.link).hostname : undefined;
	return {
		...item,
		title:
			item.title ?? `A post from ${item.creator ?? hostname ?? "somewhere"}`,
		content: item.content ? removeStyleTags(item.content) : undefined,
	};
}

async function getFeed(): Promise<FeedDataResult> {
	const feedUrls = getFeedUrls();

	const parser = new Parser();
	const feedPromises = feedUrls.map(async (feedUrl) => {
		try {
			const feed = await parser.parseURL(feedUrl);
			return {
				...feed,
				items: feed.items.map(grokFeedItem),
			};
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
	const feeds: Parser.Output<unknown>[] = [];
	const errors: Error[] = [];
	const sources: FeedSourceResult[] = results.map((result, index) => {
		const url = feedUrls[index];
		if (isFulfilled(result)) {
			const feed = result.value;
			feeds.push(feed);
			return { url, feed } satisfies FeedSourceResult;
		}

		const error = result.reason as Error;
		errors.push(error);
		return { url, error } satisfies FeedSourceResult;
	});

	return {
		sources,
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
