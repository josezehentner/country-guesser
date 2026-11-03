# Country Guesser

Ein Länder-Quiz auf einem drehbaren Globus, im Comic-Stil. Du lernst alle Länder der Welt, und der Globus zeigt dir dabei Land für Land, wie gut du sie schon kennst.

**[Jetzt spielen](https://josezehentner.github.io/country-guesser/)**: kostenlos, ohne Anmeldung, im Browser am Computer oder am Handy.

## Spielmodi

### Länder benennen

Auf dem Globus ist ein Land markiert, und du tippst seinen Namen ein. Ein Druck auf Enter genügt: Bei einer richtigen Antwort geht es von selbst weiter. Bei einer falschen siehst du den richtigen Namen und machst weiter, wenn du so weit bist.

Du musst nicht perfekt schreiben. Groß- und Kleinschreibung, fehlende Umlaute („Osterreich“) und kleine Tippfehler sind kein Problem. Auch gängige andere Namen zählen, etwa „USA“, „Amerika“, „UK“ oder „Côte d'Ivoire“.

### Länder finden

Das Spiel nennt ein Land, und du suchst es auf dem Globus und klickst es an. Bei sehr kleinen Ländern reicht ein Klick knapp daneben. Liegst du falsch, dreht sich der Globus zum richtigen Land. Mit einem weiteren Klick auf den Globus geht es weiter.

Beide Modi merken sich deinen Fortschritt getrennt: Ein Land zu erkennen und es zu finden sind zwei verschiedene Dinge.

## So funktioniert dein Fortschritt

Jedes Land hat eine Punktzahl von 0 bis 10, und der Globus färbt es entsprechend ein:

- **Beige:** noch nie gefragt
- **Grau:** 0 Punkte
- **Rot über Gelb bis Grün:** 1 bis 10 Punkte. Grün heißt: gemeistert.

Beim ersten Mal startest du mit 5 Punkten, wenn du richtig liegst, sonst mit 3. Danach bringt jede richtige Antwort einen Punkt, jede falsche oder „Weiß ich nicht“ kostet einen.

Länder, die du noch nicht gut kennst, kommen öfter dran. Gemeisterte Länder tauchen nur ab und zu zur Wiederholung auf.

## Länder auswählen

Links neben dem Globus wählst du aus, welche Länder abgefragt werden. Fahr mit der Maus an den linken Rand, und die Filter gleiten herein. Ein Klick auf die Lasche hält sie offen. Am Handy tippst du auf die Lasche.

- **Regionen:** Europa, Naher Osten, Asien, Afrika, Nordamerika, Südamerika, Ozeanien und Antarktis.
- **Schwierigkeit:**
  - *Einfach* sind rund 60 sehr bekannte Länder wie Deutschland, Brasilien oder Japan.
  - *Schwer* sind alle Gebiete ohne UN-Mitgliedschaft, etwa Grönland, Kosovo oder Französisch-Polynesien, dazu winzige Inselstaaten wie Nauru oder Tuvalu.
  - *Mittel* sind alle übrigen Länder.

Beides lässt sich kombinieren, zum Beispiel nur die einfachen Länder Afrikas. Insgesamt sind 250 Länder und Gebiete dabei.

## Bedienung

| | Computer | Handy |
|---|---|---|
| Globus drehen | ziehen | wischen |
| Zoomen | Mausrad | zwei Finger |
| Antworten (benennen) | tippen und Enter | tippen und „Los“ |
| Antworten (finden) | Land anklicken | Land antippen |
| Weiter nach falscher Antwort | Enter, „Weiter“ oder Klick auf den Globus | „Weiter“ oder Tippen auf den Globus |

Wer schnell wischt, gibt dem Globus Schwung, und er dreht sich noch ein Stück weiter. Fährst du mit der Maus über ein Land, das schon gefragt wurde, siehst du seinen Namen und seine Punktzahl.

## Deine Daten

Dein Fortschritt bleibt in deinem Browser auf deinem Gerät. Es gibt keine Anmeldung, keine Werbung und kein Tracking, und das Spiel lädt nichts von fremden Servern.

Das heißt aber auch: Ein anderes Gerät oder ein anderer Browser fängt bei null an, und in privaten Fenstern wird nichts gespeichert. Über ⚙ kannst du deinen Fortschritt als Datei **exportieren** und auf einem anderen Gerät wieder **importieren**, oder ihn **zurücksetzen**.

## Quellen und Lizenz

- Landkarte: [Natural Earth](https://www.naturalearthdata.com), gemeinfrei. Damit man sie sieht, sind sehr kleine Länder vergrößert.
- Globus: [d3](https://d3js.org), ISC-Lizenz.
- Schrift: [Bangers](https://github.com/googlefonts/bangers), SIL Open Font License.
- Deutsche Ländernamen: vom Browser selbst (`Intl.DisplayNames`), wo nötig angepasst.

Das Spiel selbst steht unter der [MIT-Lizenz](LICENSE).

## Für Entwickler

Das Spiel ist eine statische Website aus HTML, CSS und JavaScript, ohne Build-Schritt. Lokal startest du es mit `npm start` und öffnest dann http://localhost:8000. Die Tests laufen mit `npm test`.

Wie das Spiel genau funktionieren soll, steht in der [Spezifikation](docs/specification.md). Wie im Projekt gearbeitet wird, steht in [AGENTS.md](AGENTS.md).
