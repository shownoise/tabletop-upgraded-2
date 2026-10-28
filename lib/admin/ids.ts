// Id's voor beheer-records. Pure functies, geen opslag.
//
// Waarom ze hier staan en niet bij hun store: de formulieren die een nieuw
// record maken zijn client components, en ze hebben alleen dit nodig. Zolang
// de generator in de store-module stond trok die ene import de hele opslag mee
// de browserbundel in — tot en met `pg`, dat daar niet bestaat. De build viel
// om op `util/types` en `dns`.
//
// Voeg je een nieuwe store toe: zet zijn id-generator hier, niet ernaast.

export function newClientId(): string {
  return `client_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export function newRubricEntryId(): string {
  return `rubric_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}
