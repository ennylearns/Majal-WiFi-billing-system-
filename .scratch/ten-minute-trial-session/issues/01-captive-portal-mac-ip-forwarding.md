# 01: Captive Portal Client MAC & IP Parameter Forwarding

**What to build:**
When a client connects to the WiFi hotspot and is intercepted by the MikroTik captive portal redirect, the redirect script forwards the client device's physical MAC address and local IP address to the portal application in URL query parameters (`mac=$(mac)&ip=$(ip)`). This enables the web portal to recognize the specific connecting hardware device without requiring manual user input.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] RouterOS provisioning script generates a `login.html` template that includes `mac=$(mac)` and `ip=$(ip)` query parameters in both meta-refresh and JavaScript redirect URLs.
- [ ] Provisioning script unit tests verify that generated redirect URLs include router identity, router ID, MAC parameter, and IP parameter.
- [ ] Existing walled-garden rules and login redirect logic continue functioning without regression.

