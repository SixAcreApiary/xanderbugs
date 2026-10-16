# Chrome Web Store listing - Xanderbugs

Copy-paste source for the Chrome Web Store Developer Dashboard.

Published: not yet. Add the store URL and item ID here after the first approval.

## Store listing tab

**Name** (from manifest): Xanderbugs

**Summary** (from manifest, max 132 chars):
Creepy crawlies scurrying across your screen while you browse. 100% on-device.

**Category:** Fun

**Language:** English

**Description:**

```
Xanderbugs sends procedurally drawn bugs scurrying across the pages you browse: a harmless prank, a jump scare for a friend's computer, or just a bit of fun.

BUGS
Carpenter, field, fire, pavement, odorous house, Argentine and pharaoh ants; cockroaches, centipedes, spiders, silverfish, beetles, earwigs, yellowjackets, stink bugs, bedbugs and house centipedes; Italian, Cordovan, Buckfast, Carniolan, Caucasian, Russian and German black honey bees; and common eastern, buff-tailed, red-tailed, common carder, garden, American and yellow-faced bumble bees. Each one is drawn in code with its own legs, gait and walking style. Bugs steer around each other, ants sometimes stop to touch antennae or follow each other's scent trails, prey run from predators, and honey bees now and then perform a waggle dance. They are computer-generated approximations for fun, not scientifically accurate depictions.

FEATURES
- Random sightings while you browse: choose how many sightings per hour and how many bugs per sighting.
- Adjustable crawl speed, from 25% to 250% of natural speed.
- Pick which bugs can appear and how often each one shows up.
- List sites where bugs should never appear (for example your email or bank).
- Click the toolbar icon to release a wave of bugs on the current page right away.
- Right-click the toolbar icon for the Active Infestation on/off switch.
- Bugs never block clicks; the page underneath keeps working normally.

PRIVACY
No data is collected or transmitted, and the extension makes no network requests. Only your settings are stored, locally in your browser. The extension reads only the current site's name, to honour your list of sites without bugs; it never reads page content.

Open source: https://github.com/SixAcreApiary/xanderbugs
```

**Graphic assets** (regenerate with `npm run screenshots`):
- Store icon 128x128: `icons/icon128.png`
- Small promo tile 440x280: `store/promo-small-440x280.png`
- Screenshots (1280x800, 24-bit PNG with no alpha, 1-5):
  1. `store/screenshot-1-1280x800.png` - bugs crawling over a fictional gardening blog
  2. `store/screenshot-2-1280x800.png` - the settings page
- Promo video: `store/demo-1280x800.mp4` (21 s). The dashboard takes a YouTube URL, so upload it to YouTube first and paste the link.

All screenshots and the video use `store/mock-site/`, a fictional site with original text and CSS-only artwork. It contains no trademarked or copyrighted third-party material.

**Official URL:** none. **Homepage URL:** https://github.com/SixAcreApiary/xanderbugs. **Support URL:** https://github.com/SixAcreApiary/xanderbugs/issues

## Privacy practices tab

**Single purpose:**
Displays animated, computer-drawn bugs crawling across web pages for entertainment, on a schedule and with options the user controls.

**Permission justification - storage:**
Saves the user's own settings (on/off switch, sightings per hour, bugs per sighting, crawl speed, chosen bugs and their frequency, and sites without bugs) locally so they persist between sessions.

**Permission justification - alarms:**
Schedules the random bug sightings the user configured (for example 2 to 6 per hour) without keeping the background service worker running.

**Permission justification - contextMenus:**
Adds the "Active Infestation" on/off switch and "Options" to the toolbar icon's right-click menu.

**Host permission justification (content script on http://*/* and https://*/*):**
The extension's purpose is to show bugs on whatever page the user is viewing, so its content script must run on ordinary web pages. It draws the bugs in an overlay that never blocks clicks. It reads only the page's host name, to skip sites on the user's own list of sites without bugs; it never reads page content, form data or browsing history, and it makes no network requests.

**Remote code:** No, I am not using remote code. All JavaScript is packaged in the extension.

**Data usage:** Check none of the data categories. Certify:
- I do not sell or transfer user data to third parties, outside of the approved use cases.
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending purposes.

**Privacy policy URL:** https://github.com/SixAcreApiary/xanderbugs/blob/master/PRIVACY.md

## Test instructions tab

Username/password: leave blank (no account needed).

Additional instructions (max 500 chars; this is 451):

```
No account needed.
1. Open any website, e.g. https://example.com.
2. Click the Xanderbugs toolbar icon: a wave of bugs crawls across the page.
3. Right-click the icon > Options to change sightings per hour, bugs per sighting, speed, which bugs appear, and sites without bugs.
4. "Release bugs on this page" on the Options page previews the settings.
Bugs also appear on their own a few times per hour. Only local storage is used; no data is collected.
```

## Distribution tab

- Visibility: Public (or Unlisted to soft-launch with a direct link only)
- Regions: All regions
- Pricing: Free

## Upload

Build the zip with `npm run zip` (or download it from the GitHub release) and upload `xanderbugs-vX.Y.Z.zip` on the Package tab.
