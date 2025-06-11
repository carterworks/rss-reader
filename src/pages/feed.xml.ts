import { Feed } from "feed";
import Parser from "rss-parser";

function getFeedCategories(): Record<string, string[]> {
	return JSON.parse(import.meta.env.FEEDS ?? "{}");
}

export const GET: import("astro").APIRoute = async ({ request, generator }) => {
	const categories = getFeedCategories();
	const feedToCategoryMap = new Map<string, string>();
	for (const [category, feeds] of Object.entries(categories)) {
		for (const feed of feeds) {
			feedToCategoryMap.set(feed, category);
		}
	}

	console.log(
		`Retrieved ${feedToCategoryMap.size} feeds from ${Object.values(categories).flat().length} categories`,
	);
	const parser = new Parser();
	const feedPromises = Object.values(categories)
		.flat()
		.map(async (feedUrl) => {
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
	const feeds = results
		.filter((result) => result.status === "fulfilled")
		.map((result) => result.value);
	const errors = results
		.filter((result) => result.status === "rejected")
		.map((result) => result.reason);
	console.log(`Fetched ${feeds.length} feeds with ${errors.length} errors`);
	console.error("Errors:", errors);

	// combine all parsed feeds into a single atom feed.
	const feed = new Feed({
		title: "Carter's RSS Feeds",
		description: `A collection of RSS feeds that Carter follows. Contains feeds from ${feedToCategoryMap.size} sources.`,
		id: `tag:${new URL(request.url).hostname},${new Date().toISOString().slice(0, 10)}:feed`,
		link: request.url,
		language: "en-US",
		updated: new Date(),
		generator,
		copyright: `All rights reserved ${new Date().getFullYear()}`,
		feedLinks: {
			atom: request.url,
		},
		author: {
			name: "Carter",
			link: "https://carter.works",
		},
	});

	// Add categories to the main feed
	for (const category of Object.keys(categories)) {
		feed.addCategory(category);
	}

	for (const f of feeds) {
		const feedCategory =
			feedToCategoryMap.get(f.feedUrl ?? f.link ?? "") ?? "Uncategorized";

		for (const e of f.items) {
			let title = e.title;
			if (!title && !f.title) {
				title = "A new post";
			} else if (!title && f.title) {
				title = `A new post from ${f.title}`;
			}

			feed.addItem({
				title: title || `A post from ${f.title || "an unknown source"}`,
				id: e.guid || e.link || `${f.feedUrl || ""}#${e.title || "item"}`,
				link: e.link || f.link || "",
				description: e.contentSnippet || e.content || e.summary || "",
				content: e.content || e.contentSnippet || e.summary || "",
				author: e.creator
					? [
							{
								name: e.creator,
							},
						]
					: [
							{
								name: f.title || "Unknown",
								link: f.link || "",
							},
						],
				date: e.pubDate
					? new Date(e.pubDate)
					: e.isoDate
						? new Date(e.isoDate)
						: new Date(),
				category: [
					{
						name: feedCategory,
						term: feedCategory,
					},
				],
			});
		}
	}

	return new Response(feed.atom1(), {
		headers: {
			"Content-Type": "application/atom+xml",
		},
	});
};
