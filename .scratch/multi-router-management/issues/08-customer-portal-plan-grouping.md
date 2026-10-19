# 08: Customer portal: location-specific plans

**What to build:** Update the customer-facing portal so that when a user connects to a router hotspot, they only see plans available for that specific location (detected via URL query parameter `?routerId=...` or `?router=...`). The header displays the active location with an option to change location. If no router parameter is present or if the parameter does not match any active router, the portal displays a location selector dropdown allowing the user to choose their location. The full purchase flow — select a plan, pay, connect — must continue to work correctly end-to-end, with the resulting session created on the router that the chosen plan belongs to.

**Blocked by:** 04

**Status:** completed

- [x] Customer portal detects router identifier from URL query parameter (`routerId` or `router`)
- [x] Only plans assigned to the detected router location are displayed
- [x] Header/banner displays current connected location (e.g., "Connected at: <location>") with an option to change location
- [x] When URL parameter is missing or unrecognized, a location selector dropdown is displayed to let the user choose their location
- [x] When an unrecognized router parameter is passed, a warning notice is shown prompting the user to select their location
- [x] Selecting a location from the dropdown filters the displayed plans to that location
- [x] Plans display correctly (name, price, duration, data, speed)
- [x] Empty state (no plans available for the selected location) is handled gracefully with an option to change location
- [x] Selecting a plan and completing the full purchase + connect flow works end-to-end
