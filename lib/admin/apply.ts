// Ééne installer die alle admin overrides op de juiste plek in de runtime
// injecteert. Aanroepen aan het begin van elk server-side pad dat scoring
// gebruikt.

import { loadOverrides } from './overrides'
import { installRuntimeOverrides } from '@/lib/scoring/vector-overrides'

let installed = false
let installedAt = 0
const RE_INSTALL_MS = 30_000

export async function installAdminOverrides(): Promise<void> {
  // Cache per instance zodat we niet elke request KV hit.
  if (installed && Date.now() - installedAt < RE_INSTALL_MS) return
  const o = await loadOverrides()
  installRuntimeOverrides(o.scoring)
  installed = true
  installedAt = Date.now()
}
