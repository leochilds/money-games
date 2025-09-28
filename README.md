# Money Games - Property Tycoon

A lightweight, client-side property management mini-game built for GitHub Pages. Grow your rental empire by purchasing properties, collecting rent, and balancing your cash flow.

## Gameplay overview

- **Starting funds:** $1,000 and one in-game day already underway.
- **Goal:** Purchase properties to increase the rent you earn at the end of every day.
- **Passive income:** Owned properties automatically generate rent during each tick (in-game day).
- **History log:** Track purchases, income, and system events in the activity panel.

## Controls and UI

The interface is split into three primary sections:

1. **Player overview**
   - Shows current day, cash balance, and total rent per in-game day.
   - Game speed selector (`0.5×`, `1×`, `2×`, `4×`) adjusts how quickly days pass in real time.
   - Reset button returns the game to day 1 with the initial $1,000 capital.
2. **Property portfolio**
   - Displays each available property with its cost, rent yield, and flavour text.
   - Buttons become disabled once a property is owned or if you lack funds for the purchase.
3. **Rental income status & activity history**
   - Owned properties are summarised with their current rent output.
   - A live-updating feed lists rent events, speed changes, resets, and purchases.

## How rent and days work

- Every real-world second (or faster/slower if you change speed) advances the game by one day.
- Rent collected per tick equals the sum of rent from all owned properties and is automatically added to your balance.
- Attempts to purchase a property without enough cash are logged to the activity history for quick troubleshooting.

## Running locally

Because the game is a static HTML page, no build tools are required:

```bash
# Serve locally with any static HTTP server
python3 -m http.server
```

Then browse to `http://localhost:8000` to play. All assets load from the repository and CDN, so no backend or API keys are necessary.

## Deployment

The included GitHub Actions workflow (`.github/workflows/static.yml`) uploads the repository contents directly to GitHub Pages. No extra build steps are needed—committing the HTML, CSS, and JavaScript files is sufficient for deployment.

## Customisation ideas

- Add more properties or tune costs/rents inside `assets/js/game.js`.
- Extend the CSS theme in `assets/css/styles.css` to match your brand.
- Track additional metrics (e.g., net worth, ROI) or introduce property upgrades.
