import { Feed } from "feed";
import Parser from "rss-parser";

function getFeedCategories(): Record<string, string[]> {
	return JSON.parse(import.meta.env.FEEDS ?? "{}");
}

function xmlEncode(str: string) {
	return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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
		`Retrieved ${feedToCategoryMap.size} feeds from ${Object.values(categories).length} categories`,
	);
	const parser = new Parser();
	const feedPromises = Object.values(categories)
		.flat()
		.map(async (feedUrl) => {
			try {
				const feed = await parser.parseURL(feedUrl);
				return feed;
			} catch (e) {
				console.error(`[feed.xml.ts] Error parsing feed ${feedUrl}:`, e);
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
	console.log(
		`[feed.xml.ts] Creating combined feed with ${feeds.length} successfully parsed feeds`,
	);
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
		feed.addCategory(xmlEncode(category));
	}

	let totalItemsAdded = 0;
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

			try {
				// XML encode all text content to prevent malformed XML
				const safeTitle = xmlEncode(
					title || `A post from ${f.title || "an unknown source"}`,
				);
				const safeDescription = xmlEncode(
					e.contentSnippet || e.content || e.summary || "",
				);
				const safeContent = xmlEncode(
					e.content || e.contentSnippet || e.summary || "",
				);
				const safeAuthorName = xmlEncode(e.creator || f.title || "Unknown");

				feed.addItem({
					title: safeTitle,
					id: e.guid || e.link || `${f.feedUrl || ""}#${e.title || "item"}`,
					link: e.link || f.link || "",
					description: safeDescription,
					content: safeContent,
					author: e.creator
						? [
								{
									name: safeAuthorName,
								},
							]
						: [
								{
									name: safeAuthorName,
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
							name: xmlEncode(feedCategory),
							term: xmlEncode(feedCategory),
						},
					],
				});
				totalItemsAdded++;
			} catch (itemError) {
				console.error(
					`[feed.xml.ts] Error adding item from ${f.title || f.feedUrl}:`,
					itemError,
				);
				console.error("[feed.xml.ts] Problematic item:", {
					title: e.title,
					link: e.link,
					content: `${e.content?.substring(0, 200)}...`,
					contentSnippet: `${e.contentSnippet?.substring(0, 200)}...`,
				});
			}
		}
	}
	console.log(
		`[feed.xml.ts] Added ${totalItemsAdded} total items to combined feed`,
	);

	try {
		const atomXml = feed.atom1();
		console.log(
			`[feed.xml.ts] Generated Atom XML with ${totalItemsAdded} items (${atomXml.length} chars)`,
		);
		return new Response(atomXml, {
			headers: {
				"Content-Type": "application/atom+xml",
			},
		});
	} catch (xmlError) {
		console.error("[feed.xml.ts] Error generating final XML:", xmlError);
		throw xmlError;
	}
};
