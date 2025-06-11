// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { R2Bucket, D1Database, KVNamespace } from '@cloudflare/workers-types';

declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		interface Platform {
			env: {
				IMAGES_BUCKET: R2Bucket;
				DB: D1Database;
				IMAGE_DATA: KVNamespace;
				USER_DATA: KVNamespace;
				GAME_DATA: KVNamespace;
				CORS_ORIGIN: string;
				MAX_FILE_SIZE: string;
				ALLOWED_FILE_TYPES: string;
				ENVIRONMENT: string;
				// Supabase environment variables
				PUBLIC_SUPABASE_URL: string;
				PUBLIC_SUPABASE_ANON_KEY: string;
			};
			context: {
				waitUntil(promise: Promise<any>): void;
			};
			caches: CacheStorage & { default: Cache };
		}
	}
}

export {};
