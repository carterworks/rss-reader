import type { APIRoute, GetStaticPaths } from "astro";
import { getFeed } from "../feed.xml";

async function getAllFeedItems() {
	const feed = await getFeed({ requestUrl: "https://carter.works/feed.xml" });
	return feed.items;
}
type Item = Awaited<ReturnType<typeof getAllFeedItems>>;
export const getStaticPaths: GetStaticPaths = async () => {
	let items: ReturnType<typeof getAllFeedItems> | undefined;
	let error: Error | undefined;
	try {
		items = await getAllFeedItems();
		const urls: string[] = (items ?? ([] satisfies Item[])).map(
			(item: { link: string }) => item.link,
		);
		return Array.from(new Set(urls.map((url) => new URL(url).hostname))).map(
			(domain) => ({
				params: { domain },
			}),
		);
	} catch (err) {
		error = err as Error;
		error.message = `Error fetching feeds: ${error.message}`;
		throw error;
	}
};

export const GET: APIRoute = async ({ params }) => {
	const { domain } = params;

	const response = await fetch(
		`https://www.google.com/s2/favicons?domain=${domain}`,
		{
			redirect: "follow",
		},
	);
	const buffer = await response.arrayBuffer();

	return new Response(buffer, {
		headers: { "Content-Type": "image/x-icon" },
	});
};
