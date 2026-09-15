/**
 * Data Protection & Token Encryption Service
 * Implements authenticated AES-256-GCM encryption using standard Web Crypto API.
 * Ensures OAuth refresh tokens and sensitive credentials stored in D1 are never stored in plaintext.
 */

async function getEncryptionKey(secret: string): Promise<CryptoKey> {
	const enc = new TextEncoder();
	const keyMaterial = await crypto.subtle.digest('SHA-256', enc.encode(secret));
	return crypto.subtle.importKey(
		'raw',
		keyMaterial,
		{ name: 'AES-GCM' },
		false,
		['encrypt', 'decrypt']
	);
}

function bufferToHex(buffer: Uint8Array): string {
	return Array.from(buffer)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

function hexToBuffer(hex: string): Uint8Array {
	const matches = hex.match(/.{1,2}/g);
	if (!matches) return new Uint8Array(0);
	return new Uint8Array(matches.map((byte) => parseInt(byte, 16)));
}

/**
 * Encrypt a sensitive token string (e.g. Google or Outlook OAuth refresh token).
 * Produces format: enc:v1:<12-byte-hex-iv>:<hex-ciphertext-and-tag>
 */
export async function encryptToken(
	plaintext: string | null | undefined,
	secret: string
): Promise<string | null> {
	if (!plaintext || plaintext.trim() === '') {
		return null;
	}

	// Idempotency: avoid double encrypting
	if (plaintext.startsWith('enc:v1:')) {
		return plaintext;
	}

	try {
		const key = await getEncryptionKey(secret);
		const iv = crypto.getRandomValues(new Uint8Array(12));
		const enc = new TextEncoder();

		const encrypted = await crypto.subtle.encrypt(
			{ name: 'AES-GCM', iv },
			key,
			enc.encode(plaintext)
		);

		const ivHex = bufferToHex(iv);
		const cipherHex = bufferToHex(new Uint8Array(encrypted));

		return `enc:v1:${ivHex}:${cipherHex}`;
	} catch (err) {
		console.error('Token encryption failed:', err);
		throw new Error('Cryptographic token encryption failed');
	}
}

/**
 * Decrypt a sensitive token string.
 * Supports backward compatibility with unencrypted legacy tokens (returns raw token if not matching enc:v1: prefix).
 * Supports multi-secret failover (e.g. key rotation or fallback to clientSecret).
 */
export async function decryptToken(
	ciphertext: string | null | undefined,
	secretOrSecrets: string | string[]
): Promise<string | null> {
	if (!ciphertext || ciphertext.trim() === '') {
		return null;
	}

	// Backward compatibility with legacy plaintext tokens
	if (!ciphertext.startsWith('enc:v1:')) {
		return ciphertext;
	}

	const parts = ciphertext.split(':');
	if (parts.length !== 4) {
		// Malformed ciphertext format, return as fallback
		return ciphertext;
	}

	const ivHex = parts[2];
	const cipherHex = parts[3];

	const iv = hexToBuffer(ivHex);
	const data = hexToBuffer(cipherHex);

	if (iv.length !== 12 || data.length === 0) {
		console.error('Invalid IV or ciphertext length in token payload');
		return null;
	}

	const secrets = Array.isArray(secretOrSecrets) ? secretOrSecrets : [secretOrSecrets];

	for (const secret of secrets) {
		if (!secret) continue;
		try {
			const key = await getEncryptionKey(secret);
			const decrypted = await crypto.subtle.decrypt(
				{ name: 'AES-GCM', iv: iv as unknown as BufferSource },
				key,
				data as unknown as BufferSource
			);
			return new TextDecoder().decode(decrypted);
		} catch {
			// Try next candidate secret if key rotated
			continue;
		}
	}

	console.error('Failed to decrypt token with available secret keys');
	return null;
}
