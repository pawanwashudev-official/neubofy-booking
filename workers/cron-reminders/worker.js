/**
 * Cron Worker for Neubofy Booking email reminders
 * Runs every 5 minutes and calls the main app's reminder endpoint
 */

export default {
	async scheduled(event, env) {
		const url = `${env.APP_URL}/api/cron/send-reminders`;

		try {
			const response = await fetch(url, {
				headers: {
					'Authorization': `Bearer ${env.CRON_SECRET}`
				}
			});
			const result = await response.json();
			console.log('Cron reminder result:', result);
		} catch (err) {
			console.error('Cron reminder failed:', err);
		}
	}
};
