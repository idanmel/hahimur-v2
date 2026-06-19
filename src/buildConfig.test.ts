import { describe, it, expect } from 'vitest'
import viteConfig from '../vite.config'

// Regression guard for the blank-screen-on-mobile bug: without an explicit
// build target, esbuild ships ES2021+ syntax (??=, ||=, &&=) verbatim and older
// mobile browsers fail to parse the whole bundle — React never mounts and the
// page is a silent blank. Keep a conservative downlevel floor so the emitted JS
// parses everywhere. If you intentionally raise the floor, update this test.
describe('vite build target stays mobile-safe', () => {
  it('pins a conservative downlevel target', () => {
    const cfg = viteConfig as { build?: { target?: string | string[] } }
    const target = cfg.build?.target
    expect(target, 'build.target must be set in vite.config.ts').toBeDefined()
    const targets = Array.isArray(target) ? target : [target as string]
    expect(targets).toContain('es2019')
  })
})
