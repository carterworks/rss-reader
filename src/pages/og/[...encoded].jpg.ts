import { fetchFeedData } from "../../lib/feedData";
import { decodeItemLink, encodeItemLink } from "../../lib/itemLinkEncoding";

const SUPPORTED_META_PROPERTIES = new Set([
	"og:image",
	"og:image:url",
	"twitter:image",
	"twitter:image:src",
]);

function extractMetaTags(html: string): Array<Record<string, string>> {
	const tags: Array<Record<string, string>> = [];
	const metaTagRegex = /<meta\s+[^>]*>/gi;
	const matches = html.match(metaTagRegex) ?? [];

	for (const tag of matches) {
		const attributes: Record<string, string> = {};
		for (const attributeMatch of tag.matchAll(
			/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi,
		)) {
			const [, name, doubleQuoted, singleQuoted] = attributeMatch;
			attributes[name.toLowerCase()] = (
				doubleQuoted ??
				singleQuoted ??
				""
			).trim();
		}
		if (Object.keys(attributes).length > 0) {
			tags.push(attributes);
		}
	}

	return tags;
}

function resolveOgImageUrl(html: string, pageUrl: string): string | undefined {
	const tags = extractMetaTags(html);
	for (const attrs of tags) {
		const property = attrs.property ?? attrs.name;
		if (!property) {
			continue;
		}

		if (!SUPPORTED_META_PROPERTIES.has(property.toLowerCase())) {
			continue;
		}

		const value = attrs.content ?? attrs.value;
		if (!value) {
			continue;
		}

		try {
			return new URL(value, pageUrl).toString();
		} catch {}
	}

	return undefined;
}

async function fetchOgImage(link: string): Promise<Response> {
	try {
		const pageResponse = await fetch(link);
		if (!pageResponse.ok) {
			return new Response(null, { status: pageResponse.status });
		}

		const html = await pageResponse.text();
		const ogImageUrl = resolveOgImageUrl(html, link);

		if (!ogImageUrl) {
			return new Response(null, { status: 404 });
		}

		const imageResponse = await fetch(ogImageUrl);
		if (!imageResponse.ok) {
			return new Response(null, { status: imageResponse.status });
		}

		const buffer = await imageResponse.arrayBuffer();

		return new Response(buffer, {
			headers: {
				"Content-Type":
					imageResponse.headers.get("Content-Type") ?? "image/jpeg",
				"Cache-Control": "public, max-age=86400",
				ETag: imageResponse.headers.get("ETag") ?? "",
				"Last-Modified": imageResponse.headers.get("Last-Modified") ?? "",
			},
		});
	} catch (error) {
		console.error(`[og] Failed to fetch OpenGraph image for ${link}:`, error);
		return new Response(null, { status: 500 });
	}
}

export const getStaticPaths: import("astro").GetStaticPaths = async () => {
	const { feeds } = await fetchFeedData();
	const itemLinks = Array.from(
		new Set(
			feeds
				.flatMap((feed) => feed.items)
				.map((item) => item.link)
				.filter((link): link is string => typeof link === "string"),
		),
	);

	return itemLinks.map((link) => ({
		params: {
			encoded: encodeItemLink(link),
		},
	}));
};

export const GET: import("astro").APIRoute = async ({ params }) => {
	const encoded = Array.isArray(params.encoded)
		? params.encoded[0]
		: (params.encoded ?? "");

	if (!encoded) {
		return new Response(null, { status: 400 });
	}

	try {
		const link = decodeItemLink(encoded);
		return await fetchOgImage(link);
	} catch (error) {
		console.error(`[og] Failed to decode path segment '${encoded}':`, error);
		return new Response(null, { status: 400 });
	}
};
