/**
 * Firebase Client SDK Initialization & Helpers
 * Supports Google OAuth, Email/Password sign-in, Firestore sync,
 * Google Analytics, and Web Crashlytics / Exception Tracking.
 * ZERO hardcoded secrets: reads dynamically from Cloudflare Secret variable via /api/config/firebase.
 */

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
	getAuth,
	GoogleAuthProvider,
	signInWithPopup,
	signInWithEmailAndPassword,
	createUserWithEmailAndPassword,
	updateProfile,
	signOut,
	onAuthStateChanged,
	type Auth,
	type User
} from 'firebase/auth';
import {
	getFirestore,
	doc,
	setDoc,
	serverTimestamp,
	increment,
	type Firestore
} from 'firebase/firestore';
import {
	getAnalytics,
	isSupported as isAnalyticsSupported,
	logEvent,
	type Analytics
} from 'firebase/analytics';
import { browser } from '$app/environment';
import { writable } from 'svelte/store';

let cachedConfig: any = null;
let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let firestore: Firestore | null = null;
let analytics: Analytics | null = null;

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const clientUser = writable<User | null>(null);
export const clientAuthLoading = writable<boolean>(true);

/**
 * Fetch Firebase config dynamically from Cloudflare runtime secret endpoint
 */
export async function fetchFirebaseConfig(): Promise<any> {
	if (cachedConfig) return cachedConfig;

	// 1. Check if provided at build time (e.g. in .env or GitHub secret)
	const envConfig = (import.meta as any).env?.PUBLIC_FIREBASE_CONFIG;
	if (envConfig) {
		try {
			cachedConfig = typeof envConfig === 'string' ? JSON.parse(envConfig) : envConfig;
			return cachedConfig;
		} catch (e) {
			console.warn('[firebase] Error parsing PUBLIC_FIREBASE_CONFIG:', e);
		}
	}

	// 2. Fetch from Cloudflare runtime secret endpoint
	if (browser) {
		try {
			const res = await fetch('/api/config/firebase');
			if (res.ok) {
				cachedConfig = await res.json();
				return cachedConfig;
			}
		} catch (e) {
			console.error('[firebase] Failed to fetch runtime config from /api/config/firebase:', e);
		}
	}

	return null;
}

/**
 * Auto-clean corrupted browser auth storage & cookies
 */
export function clearCorruptedClientStorage() {
	if (!browser) return;
	try {
		for (let i = localStorage.length - 1; i >= 0; i--) {
			const key = localStorage.key(i);
			if (key && (key.startsWith('firebase:') || key.includes('firebaseapp'))) {
				localStorage.removeItem(key);
			}
		}
		document.cookie = 'session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
		document.cookie = 'neubofy_workspace_mode=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
	} catch (e) {
		console.warn('[firebase] Error during storage auto-clean:', e);
	}
}

/**
 * Initialize Firebase App, Auth, Analytics, and Web Crashlytics
 */
export async function initFirebase(): Promise<Auth | null> {
	if (!browser) return null;
	if (auth) return auth;

	const config = await fetchFirebaseConfig();
	if (!config) {
		clientAuthLoading.set(false);
		return null;
	}

	if (!app) {
		try {
			app = getApps().length > 0 ? getApps()[0] : initializeApp(config);
		} catch (err) {
			console.error('[firebase:init] Error initializing Firebase app, clearing cache:', err);
			clearCorruptedClientStorage();
			try {
				app = initializeApp(config);
			} catch (retryErr) {
				console.error('[firebase:init] Critical init failure:', retryErr);
				clientAuthLoading.set(false);
				return null;
			}
		}
	}

	// Initialize Firebase Auth
	if (!auth && app) {
		try {
			auth = getAuth(app);
			onAuthStateChanged(
				auth,
				(user) => {
					clientUser.set(user);
					clientAuthLoading.set(false);
				},
				(err) => {
					console.warn('[firebase:auth] onAuthStateChanged error:', err);
					clearCorruptedClientStorage();
					clientUser.set(null);
					clientAuthLoading.set(false);
				}
			);
		} catch (authErr) {
			console.error('[firebase:auth] Error getting Auth instance:', authErr);
			clearCorruptedClientStorage();
			clientAuthLoading.set(false);
		}
	}

	// Initialize Google Analytics for Web
	if (!analytics && app && config.measurementId) {
		try {
			const supported = await isAnalyticsSupported();
			if (supported) {
				analytics = getAnalytics(app);
				logEvent(analytics, 'page_view', { page_location: window.location.href });
			}
		} catch (analyticsErr) {
			console.warn('[firebase:analytics] Analytics initialization error:', analyticsErr);
		}
	}

	// Initialize Web Crashlytics & Global Exception Tracking
	setupWebCrashlytics();

	return auth;
}

/**
 * Web Crashlytics: Automatically tracks uncaught errors and logs them to Analytics & Firestore
 */
let crashlyticsInitialized = false;
function setupWebCrashlytics() {
	if (!browser || crashlyticsInitialized) return;
	crashlyticsInitialized = true;

	// Global runtime JavaScript error listener
	window.addEventListener('error', (event) => {
		recordWebCrash(
			event.error || new Error(event.message || 'Unknown runtime error'),
			true,
			{ filename: event.filename, lineno: event.lineno, colno: event.colno }
		);
	});

	// Global unhandled promise rejection listener
	window.addEventListener('unhandledrejection', (event) => {
		const reason = event.reason;
		const err = reason instanceof Error ? reason : new Error(String(reason || 'Unhandled Promise Rejection'));
		recordWebCrash(err, false, { type: 'unhandled_rejection' });
	});
}

/**
 * Record a client crash or exception
 */
export function recordWebCrash(error: Error, fatal = false, context?: Record<string, any>) {
	if (!browser) return;

	// 1. Log exception to Google Analytics
	if (analytics) {
		try {
			logEvent(analytics, 'exception', {
				description: `${error.name}: ${error.message} at ${window.location.pathname}`,
				fatal
			});
		} catch {}
	}

	// 2. Mirror crash to Firestore for real-time error auditing
	try {
		const db = firestore || (app ? getFirestore(app) : null);
		if (db) {
			const crashId = `crash_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
			const crashRef = doc(db, 'web_crashes', crashId);
			setDoc(crashRef, {
				name: error.name,
				message: error.message,
				stack: error.stack || null,
				fatal,
				url: window.location.href,
				pathname: window.location.pathname,
				userAgent: navigator.userAgent,
				context: context || null,
				timestamp: serverTimestamp()
			}).catch(() => {});
		}
	} catch {}
}

/**
 * Helper to log custom Google Analytics events
 */
export function logAnalyticsEvent(eventName: string, eventParams?: Record<string, any>) {
	if (!browser || !analytics) return;
	try {
		logEvent(analytics, eventName, eventParams);
	} catch (e) {
		console.warn('[firebase:analytics] Event log error:', e);
	}
}

// Auto-initialize in browser on module load
if (browser) {
	initFirebase().catch((e) => console.warn('[firebase] Background init:', e));
}

export function getFirebaseAuth(): Auth | null {
	return auth;
}

export async function getFirebaseFirestore(): Promise<Firestore | null> {
	if (!browser) return null;
	if (!firestore) {
		if (!auth) await initFirebase();
		if (app) {
			firestore = getFirestore(app);
		}
	}
	return firestore;
}

/**
 * Sign in using Google OAuth popup
 */
export async function signInWithGoogle(): Promise<User> {
	let authInstance = auth;
	if (!authInstance) authInstance = await initFirebase();
	if (!authInstance) throw new Error('Firebase Auth is not ready. Please verify Cloudflare FIREBASE_CONFIG secret.');
	const result = await signInWithPopup(authInstance, googleProvider);
	logAnalyticsEvent('login', { method: 'google' });
	return result.user;
}

/**
 * Sign in with email and password
 */
export async function signInWithEmail(email: string, pass: string): Promise<User> {
	let authInstance = auth;
	if (!authInstance) authInstance = await initFirebase();
	if (!authInstance) throw new Error('Firebase Auth is not ready. Please verify Cloudflare FIREBASE_CONFIG secret.');
	const result = await signInWithEmailAndPassword(authInstance, email, pass);
	logAnalyticsEvent('login', { method: 'email' });
	return result.user;
}

/**
 * Sign up with email, password, and optional full name
 */
export async function signUpWithEmail(email: string, pass: string, name?: string): Promise<User> {
	let authInstance = auth;
	if (!authInstance) authInstance = await initFirebase();
	if (!authInstance) throw new Error('Firebase Auth is not ready. Please verify Cloudflare FIREBASE_CONFIG secret.');
	const result = await createUserWithEmailAndPassword(authInstance, email, pass);
	if (name && result.user) {
		await updateProfile(result.user, { displayName: name });
	}
	logAnalyticsEvent('sign_up', { method: 'email' });
	return result.user;
}

/**
 * Sign out of client portal account
 */
export async function signOutClient(): Promise<void> {
	if (auth) {
		await signOut(auth);
		clientUser.set(null);
		logAnalyticsEvent('logout');
	}
}

/**
 * Sync consultation booking details to Firestore under /clients/{uid}/bookings/{bookingId}
 */
export async function syncBookingToFirestore(params: {
	clientUid: string;
	bookingId: string;
	attendeeName: string;
	attendeeEmail: string;
	attendeePhone?: string;
	eventSlug: string;
	eventName: string;
	expertName: string;
	expertId: string;
	startTime: string;
	endTime: string;
	durationMinutes: number;
	priceAmount: number;
	couponCode?: string;
	meetingUrl?: string;
}): Promise<void> {
	if (!browser) return;
	try {
		const db = await getFirebaseFirestore();
		if (!db) return;

		// 1. Update / create Client Record in Firestore
		const clientDocRef = doc(db, 'clients', params.clientUid);
		await setDoc(
			clientDocRef,
			{
				uid: params.clientUid,
				displayName: params.attendeeName,
				email: params.attendeeEmail,
				phone: params.attendeePhone || null,
				lastConsultationDate: params.startTime,
				updatedAt: serverTimestamp(),
				totalBookings: increment(1)
			},
			{ merge: true }
		);

		// 2. Add Booking Record under /clients/{uid}/bookings/{bookingId}
		const bookingDocRef = doc(db, 'clients', params.clientUid, 'bookings', params.bookingId);
		await setDoc(bookingDocRef, {
			id: params.bookingId,
			eventSlug: params.eventSlug,
			eventName: params.eventName,
			expertName: params.expertName,
			expertId: params.expertId,
			startTime: params.startTime,
			endTime: params.endTime,
			durationMinutes: params.durationMinutes,
			priceAmount: params.priceAmount,
			couponCode: params.couponCode || null,
			meetingUrl: params.meetingUrl || null,
			status: 'confirmed',
			createdAt: serverTimestamp()
		});

		// 3. Log conversion in Analytics
		logAnalyticsEvent('purchase', {
			transaction_id: params.bookingId,
			value: params.priceAmount,
			currency: 'INR',
			items: [{ item_name: params.eventName, item_category: 'Consultation' }]
		});
	} catch (err) {
		console.warn('[firebase:sync] Could not sync booking to Firestore (offline or rule restricted):', err);
	}
}
