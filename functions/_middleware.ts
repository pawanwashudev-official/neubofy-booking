import type { PagesFunction } from '@cloudflare/workers-types';

export const onRequest: PagesFunction<any> = async (context): Promise<any> => {
	const { request, next } = context;
	const url = new URL(request.url);
	const path = url.pathname;

	// Add security headers
	const response = await next();
	const headers = new Headers(response.headers as any);

	// Security headers
	headers.set('X-Frame-Options', 'DENY');
	headers.set('X-Content-Type-Options', 'nosniff');
	headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
	headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
	headers.set(
		'Content-Security-Policy',
		[
			"default-src 'self'",
			"script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
			"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
			"font-src 'self' https://fonts.gstatic.com",
			"img-src 'self' https: data:",
			"connect-src 'self' https://api.resend.com https://accounts.google.com https://oauth2.googleapis.com https://www.googleapis.com https://login.microsoftonline.com https://graph.microsoft.com https://challenges.cloudflare.com",
			"frame-src https://challenges.cloudflare.com",
			"base-uri 'self'",
			"form-action 'self' https://accounts.google.com https://login.microsoftonline.com"
		].join('; ')
	);

	// Cache headers based on path
	if (path.startsWith('/api/availability')) {
		// Cache availability endpoints
		headers.set('Cache-Control', 'public, max-age=300, s-maxage=300'); // 5 minutes
		headers.set('CDN-Cache-Control', 'max-age=300');
	} else if (path.startsWith('/api/events') || path.startsWith('/api/users')) {
		// Cache relatively static data
		headers.set('Cache-Control', 'public, max-age=3600, s-maxage=3600'); // 1 hour
		headers.set('CDN-Cache-Control', 'max-age=3600');
	} else if (path.startsWith('/book/')) {
		// Cache booking pages
		headers.set('Cache-Control', 'public, max-age=300, s-maxage=300');
		headers.set('CDN-Cache-Control', 'max-age=300');
	} else if (path.match(/\.(js|css|png|jpg|jpeg|svg|ico|woff2?)$/)) {
		// Long cache for static assets
		headers.set('Cache-Control', 'public, max-age=31536000, immutable');
		headers.set('CDN-Cache-Control', 'max-age=31536000');
	} else if (request.method === 'GET' && !path.startsWith('/dashboard') && !path.startsWith('/auth') && !path.startsWith('/api') && !path.startsWith('/cancel') && !path.startsWith('/reschedule')) {
		// Public organization and booking pages contain no authenticated data.
		headers.set('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');
		headers.set('CDN-Cache-Control', 'max-age=300');
	}

	return new Response(response.body as any, {
		status: response.status,
		statusText: response.statusText,
		headers
	});
};