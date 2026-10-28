// Leeg, en dat is de bedoeling.
//
// lib/db.ts doet `import "server-only"` zodat een waarde-import uit een client
// component meteen faalt in plaats van `pg` de browserbundel in te trekken.
// Dat pakket kiest zijn variant op de `react-server`-conditie, die Next wél
// zet en vitest niet — dus in de tests laadt de variant die altijd gooit, en
// viel de halve suite om. vitest.config.ts wijst `server-only` hierheen.
//
// Niet vervangen door de `react-server`-conditie in vitest: die verandert ook
// hoe React zelf resolveert, en daar hangen de component-tests aan.
export {}
