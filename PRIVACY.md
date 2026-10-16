# Privacy Policy - Xanderbugs

_Last updated: October 15, 2026_

Xanderbugs is a browser extension that draws animated bugs crawling across the web pages you visit, entirely inside your own browser.

## Data collection

The extension **does not collect, transmit, sell or share any personal or usage data.** It has no analytics, no tracking, no remote servers and makes no network requests of its own.

## Data stored on your device

The extension saves one settings object using the browser's local extension storage (`chrome.storage.local`, which is not synced to other devices):

- whether Active Infestation is on
- bug sightings per hour and bugs per sighting
- crawl speed
- which bugs can appear and how often each is picked
- your list of sites without bugs

These never leave your browser. Removing the extension deletes them.

## Page access

The extension's content script runs on http and https pages so bugs can appear on whatever page you are viewing. It reads only the page's host name (for example `example.com`) to check it against your list of sites without bugs. It does not read, store or send page content, form data, browsing history or account details.

## Third parties

The settings page includes an optional "Buying me a Coffee" link to buymeacoffee.com. Nothing is sent there unless you click it, and that site's own privacy policy then applies.

## Contact

Questions: open an issue at <https://github.com/SixAcreApiary/xanderbugs/issues>.
