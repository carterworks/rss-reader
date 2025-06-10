import { extract } from "@extractus/feed-extractor";

export const RECENT_FEED_CUTOFF_TIME = import.meta.env.RECENT_FEED_CUTOFF_TIME
	? Number.parseInt(import.meta.env.RECENT_FEED_CUTOFF_TIME)
	: 6 * 60 * 60 * 1000;

export interface FeedItem {
	title: string;
	feedName: string;
	feedLink: string;
	pubIsoDate: number;
	link: string;
	category: string;
}

function readFeedCategoriesFromEnv(): Record<string, string[]> {
	if (import.meta.env.FEEDS) {
		return JSON.parse(import.meta.env.FEEDS);
	}
	throw new Error("FEEDS environment variable is not set");
}

async function parseFeedContents(
	feedUrl: string,
	category: string,
): Promise<FeedItem[]> {
	const start = performance.now();
	console.log(`Fetching: ${feedUrl}...`);
	let items: FeedItem[] = [];
	try {
		const result = await extract(feedUrl, {
			descriptionMaxLen: 1,
			useISODateFormat: false,
		});
		items = (result.entries ?? []).map((entry) => ({
			feedName: result.title || "Unknown Feed",
			feedLink: result.link || "",
			category,
			title: entry.title || `A post from ${result.title}`,
			pubIsoDate: new Date(entry.published ?? new Date()).getTime(),
			link: entry.link || "",
		}));
	} catch (err) {
		console.error(`${feedUrl}\n${err}`);
		throw err;
	} finally {
		console.log(
			`Fetched: ${feedUrl} in ${(performance.now() - start) / 1000}s`,
		);
	}
	return items;
}

/**
 * @param {number} [cutoffTime] - The time to cutoff the feed items.
 * @returns {Promise<{contents: FeedItem[], errors: Error[]}>} The feed items.
 */
export default async function getAllFeedItems(
	cutoffTime: number = Date.now() - RECENT_FEED_CUTOFF_TIME,
): Promise<{
	contents: FeedItem[];
	errors: Error[];
}> {
	const feedCategories = readFeedCategoriesFromEnv();

	const results = (
		await Promise.allSettled(
			Object.entries(feedCategories)
				.flatMap(([category, feeds]) =>
					feeds.map((feedUrl) => ({ category, feedUrl })),
				)
				.flatMap(({ category, feedUrl }) => {
					return parseFeedContents(feedUrl, category).catch((err) => {
						let toThrow: Error;
						if (err instanceof Error) {
							err.message = `${feedUrl}: ${err.message}`;
							toThrow = err;
						} else {
							toThrow = new Error(`${feedUrl}: ${err}`);
						}
						return Promise.reject(toThrow);
					});
				}),
		)
	).reduce(
		(acc, result) => {
			if (result.status === "fulfilled") {
				acc.contents.push(...result.value);
			} else {
				acc.errors.push(result.reason);
			}
			return acc;
		},
		{ contents: [] as FeedItem[], errors: [] as Error[] },
	);
	results.contents = results.contents.filter(
		(item) => item.pubIsoDate > cutoffTime,
	);
	results.contents.sort((a, b) => b.pubIsoDate - a.pubIsoDate);
	return results;
}
