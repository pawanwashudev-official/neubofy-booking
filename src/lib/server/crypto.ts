/**
 * Cryptographic helpers for signing, hashing, and timing-safe verification.
 * Uses Web Crypto API compatible with Cloudflare Workers.
 */

export async function hashString(str: string): Promise<string> {
	const encoder = new TextEncoder();
	const data = encoder.encode(str);
	const hashBuffer = await crypto.subtle.digest('SHA-256', data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function timingSafeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	const encoder = new TextEncoder();
	const bufA = encoder.encode(a);
	const bufB = encoder.encode(b);
	let result = 0;
	for (let i = 0; i < bufA.length; i++) {
		result |= bufA[i] ^ bufB[i];
	}
	return result === 0;
}

export async function createSignedToken<T extends object>(payload: T, secret: string): Promise<string> {
	const data = btoa(JSON.stringify(payload));
	const signature = await hashString(`${data}.${secret}`);
	return `${data}.${signature}`;
}

export async function verifySignedToken<T extends object>(
	token: string,
	secret: string,
	maxAgeMs?: number
): Promise<T | null> {
	try {
		const [data, signature] = token.split('.');
		if (!data || !signature) return null;

		const expectedSignature = await hashString(`${data}.${secret}`);
		if (!timingSafeEqual(signature, expectedSignature)) {
			return null;
		}

		const payload = JSON.parse(atob(data)) as T & { iat?: number };
		if (maxAgeMs !== undefined && typeof payload.iat === 'number') {
			const age = Date.now() - payload.iat;
			if (age > maxAgeMs) {
				return null;
			}
		}

		return payload;
	} catch {
		return null;
	}
}
