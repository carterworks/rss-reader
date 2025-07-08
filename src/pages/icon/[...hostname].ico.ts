import { fetchFeedData } from "../../lib/feedData";

export const getStaticPaths: import("astro").GetStaticPaths = async () => {
  const { feeds } = await fetchFeedData();
  const itemLinks = Array.from(
    new Set(
      feeds.flatMap(f => f.items)
        .map(i => new URL(i.link ?? "").hostname)
        .filter(Boolean)
    )
  );
  return itemLinks.map(link => ({
    params: {
      hostname: link,
    },
  }));
};

export const GET: import("astro").APIRoute = async ({ params }) => {
  const { hostname } = params;

  try {
    const response = await fetch(`https://www.google.com/s2/favicons?domain=${hostname}`);

    if (!response.ok) {
      return new Response(null, { status: 404 });
    }

    const buffer = await response.arrayBuffer();

    return new Response(buffer, {
      headers: {
        'Content-Type': 'image/x-icon',
        'Cache-Control': 'public, max-age=86400', // 1 day
        'ETag': response.headers.get('ETag') ?? "",
        'Last-Modified': response.headers.get('Last-Modified') ?? "",
      },
    });
  } catch (error) {
    console.error(`[icon/${hostname}.ico] Failed to fetch favicon:`, error);
    return new Response(null, { status: 500 });
  }
};
