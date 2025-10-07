# Money Games

An interactive collection of financial literacy games built with [SvelteKit](https://kit.svelte.dev/). The live site is deployed to GitHub Pages at [leochilds.github.io/money-games](https://leochilds.github.io/money-games/).

The previous static implementation is retained in [`legacy/`](legacy/) for reference while new experiences are implemented in SvelteKit.

## Features

- ✨ Modern SvelteKit application with TypeScript support.
- 🧪 Component and unit testing powered by Vitest and Testing Library.
- 🚀 Static site generation via the SvelteKit static adapter for fast GitHub Pages deployments.

## Getting started

Install dependencies and start a local development server:

```bash
npm install
npm run dev
```

By default the development server is available at [http://localhost:5173](http://localhost:5173).

## Quality checks

Run linting and Svelte type checks locally before committing changes:

```bash
npm run lint
npm run check
```

Both commands are also run in CI before deployment.

Execute the Vitest suite in watch mode during development with:

```bash
npm run test:watch
```

### Test coverage

Generate a full coverage report using Vitest:

```bash
npm run test:coverage
```

The command produces an HTML coverage report in `coverage/index.html` alongside summary information in the terminal output. The coverage workflow is validated in CI to help guard against regressions.

## Building for production

```bash
npm run build
```

The static adapter writes the final site to the `build/` directory. When deploying to GitHub Pages from a project subpath you can configure the base path using the `BASE_PATH` environment variable:

```bash
BASE_PATH=/money-games npm run build
```

The provided GitHub Actions workflow already sets this variable to the repository name for project pages deployments.
