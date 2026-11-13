import type { Plugin } from 'vite'
import { createPublishMiddleware } from './server/publish.ts'

export interface PublishPluginOptions {
  /** Repository root used by the publish endpoint unless COC_STUDIO_REPO_ROOT overrides it. */
  repoRoot: string
}

/**
 * Local-only publish API: POST /api/publish/prepare and POST /api/publish.
 * Writes one WebP into the repo, commits only that file and pushes origin/main.
 */
export function publishPlugin(options: PublishPluginOptions): Plugin {
  return {
    name: 'coc-studio-publish',
    configureServer(server) {
      server.middlewares.use(createPublishMiddleware(options.repoRoot))
    },
  }
}
