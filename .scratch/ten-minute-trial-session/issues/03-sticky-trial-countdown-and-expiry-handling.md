# 03: Sticky Trial Countdown Banner and Expiry Handling

**What to build:**
While a 10-minute trial is active, the customer portal displays a prominent, sticky countdown banner indicating the remaining minutes and seconds (`MM:SS`) along with an urgent call to action to select and purchase a plan to maintain connectivity. When the 10 minutes expire and the router disconnects the client, any attempt to browse redirects back to the portal where the UI displays an expired trial state and prompts the user to buy a plan.

**Blocked by:** 02: 10-Minute Trial Activation with 24-Hour MAC Cooldown

**Status:** ready-for-agent

- [ ] Customer portal renders a persistent sticky header/banner while a trial is active, showing a real-time ticking countdown (`MM:SS`).
- [ ] Sticky banner contains a direct button/scroll action anchoring the user to the plan selection section.
- [ ] Warning styles (e.g. amber/red color shift) highlight the timer when fewer than 2 minutes remain.
- [ ] When the timer reaches 00:00 or when visited after the router disconnects, the portal presents an expired trial notice explaining that internet access has paused and prompts immediate plan purchase.
- [ ] If a device is in cooldown and attempts to click the trial action, the UI displays the remaining hours/minutes until the next trial is allowed.

