import {Hono} from 'hono';
import {ServerOptions} from '../types.js';
import {setup} from '../setup.js';
import {Env} from '../env.js';

const SHIELD_BASE_URL = 'https://shield.openfort.io';

export function getEncryptionSessionAPI<CustomEnv extends Env>(
	options: ServerOptions<CustomEnv>,
) {
	const app = new Hono<{Bindings: CustomEnv}>()
		.use(setup({serverOptions: options}))
		.post('/protected-create-encryption-session', async (c) => {
			const config = c.get('config');
			const env = config.env;

			const uaHead = String(
				c.req.header('user-agent')?.split(' ')[0] || 'unknown',
			).replace(/[\[\]]/g, '');
			console.log(`[${uaHead}] Creating encryption session...`);

			const shieldApiKey = env.SHIELD_API_KEY;
			const shieldSecretKey = env.SHIELD_SECRET_KEY;
			const shieldEncryptionShare = env.SHIELD_ENCRYPTION_SHARE;

			if (!shieldApiKey || !shieldSecretKey || !shieldEncryptionShare) {
				return c.json(
					{
						success: false,
						errors: [
							{
								code: 5000,
								message: 'Shield environment variables are not set',
							},
						],
					},
					500,
				);
			}

			const shieldBaseUrl = env.SHIELD_BASE_PATH || SHIELD_BASE_URL;

			try {
				const response = await fetch(
					`${shieldBaseUrl}/project/encryption-session`,
					{
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							'x-api-key': shieldApiKey,
							'x-api-secret': shieldSecretKey,
						},
						body: JSON.stringify({
							encryption_part: shieldEncryptionShare,
						}),
					},
				);

				if (!response.ok) {
					const error = await response.text();
					console.error('Shield API error:', error);
					return c.json(
						{
							success: false,
							errors: [
								{
									code: 5020,
									message: 'Failed to create encryption session',
									cause: config.env.DEV ? error : undefined,
								},
							],
						},
						502,
					);
				}

				const data = (await response.json()) as {session_id?: string};

				if (!data.session_id) {
					return c.json(
						{
							success: false,
							errors: [
								{
									code: 5020,
									message: 'Invalid response from Shield API',
								},
							],
						},
						502,
					);
				}

				return c.json({session: data.session_id});
			} catch (error) {
				console.error(error);
				return c.json(
					{
						success: false,
						errors: [
							{
								code: 5000,
								message: 'Internal server error',
								cause: config.env.DEV ? String(error) : undefined,
							},
						],
					},
					500,
				);
			}
		});

	return app;
}
