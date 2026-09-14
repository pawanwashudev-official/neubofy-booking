/**
 * Root Public Booking Portal Load Function
 * Loads Neubofy organization info, categorized consultation services, and assigned experts
 */

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform }) => {
	const db = platform?.env?.DB;

	// Default fallback consultation services if DB is brand new or offline
	const defaultEventTypes = [
		{
			id: 'evt_tech_strategy',
			name: 'Technology Strategy & Architecture Assessment',
			slug: 'tech-strategy-assessment',
			description:
				'Evaluate your business requirements, build vs. buy decisions, system architecture, and technology roadmap before execution.',
			category: 'Decide',
			icon_name: 'lightbulb',
			durations_json: '[30, 60]',
			duration_minutes: 30,
			color: '#3b82f6',
			is_free_only: 1,
			is_active: 1
		},
		{
			id: 'evt_saas_ai_automation',
			name: 'SaaS, Integrations & AI Automation Advisory',
			slug: 'saas-integrations-ai-automation',
			description:
				'Solve disconnected systems, evaluate SaaS platforms, plan workflow & AI automations, and architect custom software capabilities.',
			category: 'Implement',
			icon_name: 'wrench',
			durations_json: '[30, 60]',
			duration_minutes: 30,
			color: '#8b5cf6',
			is_free_only: 1,
			is_active: 1
		},
		{
			id: 'evt_cloud_modernization',
			name: 'Cloud Modernization & DevOps Review',
			slug: 'cloud-modernization-devops',
			description:
				'Modernize legacy systems, optimize cloud infrastructure costs, accelerate performance, and establish scalable DevOps practices.',
			category: 'Improve',
			icon_name: 'refresh-cw',
			durations_json: '[30, 60]',
			duration_minutes: 30,
			color: '#06b6d4',
			is_free_only: 1,
			is_active: 1
		},
		{
			id: 'evt_software_audit_security',
			name: 'Software Audit, Security & Verification',
			slug: 'software-audit-security-verification',
			description:
				"The builder shouldn't be the only one deciding it's ready. Independent technical review, software code audit, QA, and security validation.",
			category: 'Protect & Verify',
			icon_name: 'shield-check',
			durations_json: '[30, 60]',
			duration_minutes: 30,
			color: '#10b981',
			is_free_only: 1,
			is_active: 1
		},
		{
			id: 'evt_external_tech_dept',
			name: 'External Technology Department Consultation',
			slug: 'external-tech-department',
			description:
				'Your technology department without building one. Ongoing technical strategy, continuous engineering oversight, and system evolution.',
			category: 'Operate',
			icon_name: 'settings',
			durations_json: '[30, 60]',
			duration_minutes: 30,
			color: '#f59e0b',
			is_free_only: 1,
			is_active: 1
		}
	];

	if (!db) {
		return {
			organization: {
				name: 'Neubofy™',
				slug: 'neubofy',
				profile_image: '/neubofylogo.png',
				brand_color: '#3b82f6'
			},
			eventTypes: defaultEventTypes,
			experts: []
		};
	}

	try {
		// 1. Fetch organization
		let organization = await db
			.prepare('SELECT id, name, slug, profile_image, brand_color, contact_email FROM organizations ORDER BY created_at LIMIT 1')
			.first<{
				id: string;
				name: string;
				slug: string;
				profile_image: string | null;
				brand_color: string | null;
				contact_email: string | null;
			}>();

		if (!organization) {
			organization = {
				id: 'org_neubofy_main',
				name: 'Neubofy™',
				slug: 'neubofy',
				profile_image: 'https://neubofy.in/neubofylogo.png',
				brand_color: '#3b82f6',
				contact_email: 'contact@neubofy.in'
			};
		}

		// 2. Fetch active consultation events
		const eventTypesResult = await db
			.prepare(
				`SELECT id, organization_id, name, slug, description, category, durations_json,
				        duration_minutes, icon_name, color, cover_image, is_free_only, is_active
				 FROM event_types
				 WHERE is_active = 1
				 ORDER BY created_at ASC`
			)
			.all();

		let eventTypes = (eventTypesResult.results as any[]) || [];
		if (eventTypes.length === 0) {
			eventTypes = defaultEventTypes;
		}

		// 3. Fetch active team members / experts
		const expertsResult = await db
			.prepare(
				`SELECT u.id, u.name, u.email, u.slug, u.profile_image, u.role_title, u.bio,
				        u.session_pricing, u.is_free_consultation, u.brand_color
				 FROM users u
				 WHERE u.is_active = 1
				 ORDER BY u.created_at ASC`
			)
			.all();

		const allExperts = (expertsResult.results as any[]).map((expert) => {
			let parsedPricing = [];
			try {
				parsedPricing = expert.session_pricing ? JSON.parse(expert.session_pricing) : [];
			} catch {}
			if (!parsedPricing || parsedPricing.length === 0) {
				parsedPricing = [
					{ duration: 30, price: 999, label: '30 Min Strategy Consultation' },
					{ duration: 60, price: 1999, label: '60 Min Deep Dive' }
				];
			}
			return {
				...expert,
				session_pricing: parsedPricing
			};
		});

		// 4. Fetch assignments between consultation events and experts
		const assignmentsResult = await db
			.prepare('SELECT event_type_id, user_id, custom_pricing FROM event_type_members WHERE is_active = 1')
			.all();

		const assignments = (assignmentsResult.results as any[]) || [];

		// Group experts per event
		const eventTypesWithExperts = eventTypes.map((et) => {
			const assignedUserIds = assignments
				.filter((a) => a.event_type_id === et.id)
				.map((a) => a.user_id);

			let assignedExperts = allExperts.filter((exp) => assignedUserIds.includes(exp.id));

			// If no explicit assignment yet, all active experts are available
			if (assignedExperts.length === 0) {
				assignedExperts = allExperts;
			}

			let parsedDurations: number[] = [30, 60];
			try {
				parsedDurations = et.durations_json ? JSON.parse(et.durations_json) : [30, 60];
			} catch {}

			return {
				...et,
				durations: parsedDurations,
				experts: assignedExperts
			};
		});

		return {
			organization,
			eventTypes: eventTypesWithExperts,
			allExperts
		};
	} catch (err) {
		console.error('Failed to load consultation portal data:', err);
		return {
			organization: {
				name: 'Neubofy™',
				slug: 'neubofy',
				profile_image: 'https://neubofy.in/neubofylogo.png',
				brand_color: '#3b82f6'
			},
			eventTypes: defaultEventTypes.map((et) => ({ ...et, durations: [30, 60], experts: [] })),
			allExperts: []
		};
	}
};
