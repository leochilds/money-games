# Money Games

This project is now powered by [SvelteKit](https://kit.svelte.dev/). The previous static site lives under [`legacy/`](legacy/) for reference while the new application is implemented.

## Getting started

```bash
npm install
npm run dev
```

By default the development server is available at [http://localhost:5173](http://localhost:5173).

## Linting and type checking

```bash
npm run lint
npm run check
```

Both commands are also run in CI before deployment.

## Building for production

```bash
npm run build
```

The static adapter writes the final site to the `build/` directory. When deploying to GitHub Pages from a project subpath you can configure the base path using the `BASE_PATH` environment variable:

```bash
BASE_PATH=/money-games npm run build
```

The provided GitHub Actions workflow already sets this variable to the repository name for project pages deployments.
