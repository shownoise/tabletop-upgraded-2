# Release-check: preview → productie

Korte controle vóór elke productiedeploy. Faalt een stap, dan gaat de release niet door.

## 1. Automatische gates

`.github/workflows/ci.yml` draait op elke push en PR, in deze volgorde:

```
pnpm exec tsc --noEmit
pnpm lint
pnpm test
pnpm build
```

Alle vier moeten groen zijn.

> **Let op:** CI *rapporteert* wel, maar *blokkeert* op dit moment niets — `main`
> heeft geen branch protection, dus een rode PR is nog steeds te mergen. Zolang
> dat zo is, is stap 1 een handmatige controle: kijk naar de check op de PR
> voordat je squash-merget.

## 2. Preview-deploy

- Deploy naar preview (`/deploy` of `vercel`).
- CI bouwt met een stub-`AUTH_SECRET`; de preview moet de echte waarden uit de
  Vercel-env pakken. Als login op preview faalt, is dat vrijwel altijd een
  ontbrekende env-variabele, geen codefout.

## 3. Wegwerpsessie op preview

Altijd met een wegwerpscenario, nooit met klantdata.

1. Facilitator logt in op `/admin`, maakt een sessie aan en start hem.
2. Deelnemer joint via `/join` met de sessiecode en kiest een rol.
3. Eén ronde volledig doorlopen: inject → overleg → keuze → lock → review.
4. Beide schermen verversen: deelnemer en facilitator staan daarna op dezelfde
   ronde én dezelfde fase.
5. `/admin/present` volgt dezelfde ronde en fase; `/observe` toont geen
   bedieningselementen.
6. Rapport bevat de gemaakte keuze met de zesdimensionale scorevector.

## 4. Auth

- `/` en `/join` zijn bereikbaar zonder sessie.
- `/admin` en `/templates` sturen zonder sessie door naar `/login`, met de
  oorspronkelijke pagina als `callbackUrl`.

Dit is automatisch gedekt door `lib/__tests__/proxy-routing.test.ts`. Handmatig
alleen narekenen als die tests zijn aangepast.

## 5. Geheimen

- Geen secrets in export, testfixtures of logs.
- `AUTH_SECRET` en API-keys komen uitsluitend uit de Vercel-env.

## 6. Na de productiedeploy

- Eén wegwerpsessie op productie draaien en daarna opruimen.
- Gaat er iets mis: revert via de Revert-knop op de PR in GitHub, niet via een
  losse fix-commit op `main`.
