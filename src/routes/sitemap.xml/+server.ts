/**
 * Dynamic XML Sitemap Generator
 * Outputs valid XML sitemap containing root URL and all active public consultation slugs.
 */

import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ platform }) => {
	const baseUrl = platform?.env?.APP_URL || platform?.env?.BASE_URL || 'https://booking.neubofy.in';
	const db = platform?.env?.DB;

	let eventSlugs: Array<{ slug: string; updated_at?: string; created_at?: string }> = [];

	if (db) {
		try {
			const result = await db
				.prepare(
					`SELECT slug, updated_at, created_at
					 FROM event_types
					 WHERE COALESCE(is_active, 1) = 1
					 ORDER BY created_at DESC`
				)
				.all();
			eventSlugs = (result.results as any[]) || [];
		} catch (err) {
			console.error('Error querying sitemap slugs:', err);
		}
	}

	const today = new Date().toISOString().split('T')[0];

	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
	<url>
		<loc>${baseUrl}/</loc>
		<lastmod>${today}</lastmod>
		<changefreq>daily</changefreq>
		<priority>1.0</priority>
	</url>
${eventSlugs
	.map((item) => {
		const lastmod = item.updated_at
			? new Date(item.updated_at).toISOString().split('T')[0]
			: item.created_at
				? new Date(item.created_at).toISOString().split('T')[0]
				: today;
		return `	<url>
		<loc>${baseUrl}/${encodeURIComponent(item.slug)}</loc>
		<lastmod>${lastmod}</lastmod>
		<changefreq>weekly</changefreq>
		<priority>0.8</priority>
	</url>`;
	})
	.join('\n')}
</urlset>`.trim();

	return new Response(xml, {
		headers: {
			'Content-Type': 'application/xml; charset=utf-8',
			'Cache-Control': 'public, max-age=3600, s-maxage=3600',
			'X-Robots-Tag': 'noindex' // XML itself should not appear as a search result snippet
		}
	});
};
