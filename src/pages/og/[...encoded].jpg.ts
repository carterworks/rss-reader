import {
	getConfiguredImageService,
	getImage,
	imageConfig,
	isLocalService,
} from "astro:assets";
import { imageMetadata } from "astro/assets/utils";
import { fetchFeedData } from "../../lib/feedData";
import {
	encodeItemLink,
	findLinkByEncodedValue,
} from "../../lib/itemLinkEncoding";

const SUPPORTED_META_PROPERTIES = new Set([
	"og:image",
	"og:image:url",
	"twitter:image",
	"twitter:image:src",
]);

const CACHE_CONTROL_HEADER = "public, max-age=86400";
const DEFAULT_CONTENT_TYPE = "image/jpeg";

type OptimizedImage = {
	data: Uint8Array;
	format?: string;
};

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

function normalizeFormat(format?: string | null): string | undefined {
	if (!format) {
		return undefined;
	}

	const normalized = format.toLowerCase();
	return normalized === "jpg" ? "jpeg" : normalized;
}

function contentTypeToFormat(contentType: string | null): string | undefined {
	if (!contentType) {
		return undefined;
	}

	const [type] = contentType.split(";");
	if (!type) {
		return undefined;
	}

	switch (type.trim().toLowerCase()) {
		case "image/jpeg":
		case "image/jpg":
			return "jpeg";
		case "image/png":
			return "png";
		case "image/webp":
			return "webp";
		case "image/avif":
			return "avif";
		case "image/gif":
			return "gif";
		case "image/svg+xml":
			return "svg";
		default:
			return undefined;
	}
}

function formatToContentType(format?: string): string {
	switch (format) {
		case "jpeg":
			return "image/jpeg";
		case "png":
			return "image/png";
		case "webp":
			return "image/webp";
		case "avif":
			return "image/avif";
		case "gif":
			return "image/gif";
		case "svg":
			return "image/svg+xml";
		case undefined:
			return DEFAULT_CONTENT_TYPE;
		default:
			return `image/${format}`;
	}
}

async function readImageMetadata(
	bytes: Uint8Array,
	link: string,
): Promise<Awaited<ReturnType<typeof imageMetadata>> | undefined> {
	try {
		return await imageMetadata(bytes);
	} catch (error) {
		console.warn(`[og] Failed to read image metadata for ${link}:`, error);
		return undefined;
	}
}

function buildResponseHeaders(
	format: string | undefined,
	sourceHeaders: Headers,
	contentLength: number,
): Record<string, string> {
	const headers: Record<string, string> = {
		"Content-Type": formatToContentType(format),
		"Cache-Control": CACHE_CONTROL_HEADER,
		"Content-Length": contentLength.toString(),
	};

	const etag = sourceHeaders.get("ETag");
	if (etag) {
		headers.ETag = etag;
	}

	const lastModified = sourceHeaders.get("Last-Modified");
	if (lastModified) {
		headers["Last-Modified"] = lastModified;
	}

	return headers;
}

async function optimizeWithGetImage(
	imageUrl: string,
	bytes: Uint8Array,
	preferredFormat: string | undefined,
): Promise<OptimizedImage | undefined> {
	const metadata = await readImageMetadata(bytes, imageUrl);
	if (
		!metadata ||
		typeof metadata.width !== "number" ||
		typeof metadata.height !== "number" ||
		metadata.width <= 0 ||
		metadata.height <= 0
	) {
		return undefined;
	}

	const targetFormat = normalizeFormat(metadata.format) ?? preferredFormat;

	try {
		const getImageOptions: Parameters<typeof getImage>[0] = {
			src: imageUrl,
			width: metadata.width,
			height: metadata.height,
		};

		if (targetFormat) {
			getImageOptions.format = targetFormat;
		}

		const { options } = await getImage(getImageOptions);
		const imageService = await getConfiguredImageService();

		if (!isLocalService(imageService)) {
			return undefined;
		}

		const { data, format } = await imageService.transform(
			bytes,
			options,
			imageConfig,
		);

		const buffer =
			data instanceof Uint8Array
				? data
				: new Uint8Array(data ?? new ArrayBuffer(0));

		if (buffer.byteLength === 0) {
			return undefined;
		}

		return {
			data: buffer,
			format: normalizeFormat(format ?? targetFormat),
		};
	} catch (error) {
		console.warn(
			`[og] Falling back to original image due to getImage failure for ${imageUrl}:`,
			error,
		);
		return undefined;
	}
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

		const originalBytes = new Uint8Array(await imageResponse.arrayBuffer());
		if (originalBytes.byteLength === 0) {
			return new Response(null, { status: 404 });
		}

		const preferredFormat = normalizeFormat(
			contentTypeToFormat(imageResponse.headers.get("Content-Type")),
		);
		const optimized = await optimizeWithGetImage(
			ogImageUrl,
			originalBytes,
			preferredFormat,
		);
		const responseBuffer = optimized?.data ?? originalBytes;
		const responseFormat = optimized?.format ?? preferredFormat;

		return new Response(responseBuffer, {
			headers: buildResponseHeaders(
				responseFormat,
				imageResponse.headers,
				responseBuffer.byteLength,
			),
		});
	} catch (error) {
		console.error(`[og] Failed to fetch OpenGraph image for ${link}:`, error);
		return new Response(null, { status: 500 });
	}
}

async function resolveLinkFromFeeds(encoded: string): Promise<string> {
	const { feeds } = await fetchFeedData();
	const match = findLinkByEncodedValue(encoded, feeds);

	if (!match) {
		throw new Error(`No feed item found for encoded value '${encoded}'`);
	}

	return match;
}
const RECENT_FEED_CUTOFF_TIME = import.meta.env.RECENT_FEED_CUTOFF_TIME
	? Number.parseInt(import.meta.env.RECENT_FEED_CUTOFF_TIME, 10)
	: 6 * 60 * 60 * 1000;
const updateTime = new Date();
const cutoffTime = new Date(updateTime.getTime() - RECENT_FEED_CUTOFF_TIME);

export const getStaticPaths: import("astro").GetStaticPaths = async () => {
	const { feeds } = await fetchFeedData();
	const itemLinks = Array.from(
		new Set(
			feeds
				.flatMap((feed) => feed.items)
				.filter((item) => item.pubDate && new Date(item.pubDate) > cutoffTime)
				.map((item) => item.link)
				.filter((link): link is string => typeof link === "string"),
		),
	);

	return itemLinks.map((link) => ({
		params: {
			encoded: encodeItemLink(link),
		},
		props: {
			link,
		},
	}));
};

export const GET: import("astro").APIRoute = async ({ params, props }) => {
	const rawEncoded = Array.isArray(params.encoded)
		? params.encoded.join("/")
		: (params.encoded ?? "");
	const encoded = rawEncoded.trim();

	if (!encoded) {
		return new Response(null, { status: 400 });
	}

	try {
		const link =
			typeof props?.link === "string"
				? props.link
				: await resolveLinkFromFeeds(encoded);
		return await fetchOgImage(link);
	} catch (error) {
		console.error(`[og] Failed to resolve link for '${encoded}':`, error);
		return new Response(null, { status: 404 });
	}
};
