import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const dev = process.argv.includes('dev');

const config = {
        // Consult https://svelte.dev/docs/kit/integrations
        // for more information about preprocessors
        preprocess: vitePreprocess(),

        kit: {
                adapter: adapter(),
                paths: {
                        base: dev ? '' : process.env.BASE_PATH ?? ''
                },
                prerender: {
                        entries: ['*']
                }
        }
};

export default config;
