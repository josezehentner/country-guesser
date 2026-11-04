# Country Guesser

A country quiz on a globe you can spin, drawn in a comic style. You learn every country in the world, and the globe shows you, country by country, how well you already know them.

**[Play now](https://josezehentner.github.io/country-guesser/)**: free, no sign-up, in the browser on a computer or phone.

The game is in German for now; more languages are planned.

## Game modes

### Name the countries ("Länder benennen")

A country is marked on the globe, and you type its name. One press of Enter is enough: after a right answer the next country comes up by itself. After a wrong one you see the right name and move on when you are ready.

You don't have to spell perfectly. Upper and lower case, missing umlauts ("Osterreich") and small typos are fine. Common other names count too, such as "USA", "Amerika", "UK" or "Côte d'Ivoire".

### Find the countries ("Länder finden")

The game names a country, and you look for it on the globe and click it. For very small countries a click just next to them is enough. If you are wrong, the globe turns to the right country. Another click on the globe moves on.

### Learn the capitals ("Hauptstädte lernen")

A country is marked on the globe, and you type its capital. It plays like "Länder benennen": the same tolerance for typos and umlauts, and the answer always shows the country too. German, English and local names count, such as "Peking" or "Beijing". Where a country has more than one capital, such as Bolivia (Sucre and La Paz) or South Africa, each of them is right. Places where nobody lives, such as Antarctica, are left out.

Every mode keeps separate progress: recognizing a country, finding it and knowing its capital are different skills.

## How your progress works

Every country has a score from 0 to 10, and the globe colors it to match:

- **Beige:** never asked
- **Gray:** 0 points
- **Red through yellow to green:** 1 to 10 points. Green means mastered.

The first time, you start at 5 points if you are right and at 3 if not. After that, every right answer adds a point, and every wrong one or "Weiß ich nicht" ("I don't know") takes one away.

Countries you don't know well yet come up more often. Mastered countries only show up now and then for review.

## Choosing countries

The filters left of the globe choose which countries are asked. Move the mouse to the left edge and they slide in; a click on the tab keeps them open. On a phone, tap the tab.

- **Regions:** Europe, Middle East, Asia, Africa, North America, South America, Oceania and Antarctica.
- **Difficulty:**
  - *Easy* ("Einfach") is about 60 very well-known countries, such as Germany, Brazil or Japan.
  - *Hard* ("Schwer") is every territory that is not a UN member, such as Greenland, Kosovo or French Polynesia, plus tiny island states like Nauru or Tuvalu.
  - *Medium* ("Mittel") is all other countries.

You can combine both, for example only the easy countries of Africa. In total there are 250 countries and territories.

## Controls

| | Computer | Phone |
|---|---|---|
| Turn the globe | drag | swipe |
| Zoom | mouse wheel | pinch |
| Answer (name, capital) | type and press Enter | type and tap "Go" |
| Answer (find) | click the country | tap the country |
| Move on after a wrong answer | Enter, "Weiter" or a click on the globe | "Weiter" or a tap on the globe |

A quick swipe gives the globe momentum, so it keeps turning for a moment.

## Your data

Your progress stays in your browser on your device. There is no sign-up, no ads and no tracking, and the game loads nothing from other servers.

That also means another device or browser starts from zero, and private windows save nothing. Under ⚙ you can **export** your progress as a file and **import** it on another device, or **reset** it.

## Credits and license

- Map: [Natural Earth](https://www.naturalearthdata.com), public domain. Very small countries are enlarged so they can be seen.
- Globe: [d3](https://d3js.org), ISC license.
- Font: [Bangers](https://github.com/googlefonts/bangers), SIL Open Font License.
- German country names: from the browser itself (`Intl.DisplayNames`), adjusted where needed.

The game itself is under the [MIT license](LICENSE).

## For developers

The game is a static website in HTML, CSS and JavaScript, with no build step. Run it locally with `npm start`, then open http://localhost:8000. Run the tests with `npm test`.

How the game must behave is in the [specification](docs/specification.md). How work on the project is done is in [AGENTS.md](AGENTS.md).
