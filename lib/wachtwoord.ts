// Één plek voor de wachtwoordregel, omdat er eerst drie verschillende waren:
// het aanmaakformulier zei minstens 8, de wijzigroute eiste 10, en de
// aanmaakroute controleerde helemaal niets — die nam elk wachtwoord aan, ook
// van één teken. Je kon dus een account maken dat je daarna niet meer mocht
// wijzigen naar hetzelfde wachtwoord.
//
// Geen eisen aan tekenklassen: die leveren in de praktijk 'Welkom01!' op.
// Lengte is wat telt.

export const MIN_WACHTWOORD_LENGTE = 10

export const WACHTWOORD_HINT = `min. ${MIN_WACHTWOORD_LENGTE} tekens`

/** `null` als het wachtwoord mag, anders de melding voor de gebruiker. */
export function wachtwoordFout(wachtwoord: unknown): string | null {
  if (typeof wachtwoord !== "string" || wachtwoord.length === 0) {
    return "Vul een wachtwoord in."
  }
  if (wachtwoord.length < MIN_WACHTWOORD_LENGTE) {
    return `Kies een wachtwoord van minstens ${MIN_WACHTWOORD_LENGTE} tekens.`
  }
  return null
}
