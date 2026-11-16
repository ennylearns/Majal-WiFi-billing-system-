# 10: Plan router selector

**What to build:** Replace the "Advanced Settings" collapsible section in the Plan creation and edit modal with a required Router selector. The selector is a dropdown populated from `adminAPI.getRouters()`, with each option labelled `{name} — {location}`. The selected router's ID is passed as `routerId` in the create and update payloads, satisfying the backend's existing validation. The form's submit button is disabled while routers are loading. This is a frontend-only change — no schema migration and no backend route changes are needed.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Plan modal fetches the router list via `adminAPI.getRouters()` on mount
- [ ] A required `<select>` field labelled "Router" is rendered in place of the "Advanced Settings" section
- [ ] Each option shows `{router.name} — {router.location}`
- [ ] The submit button is disabled while the router list is loading
- [ ] `routerId` is included in the `formData` initial state (empty string for create, existing value for edit)
- [ ] `routerId` is sent in the payload for both `adminAPI.createPlan` and `adminAPI.updatePlan`
- [ ] The form cannot be submitted with no router selected (native `required` constraint or equivalent validation)
- [ ] The edit modal pre-selects the plan's current router when opened
- [ ] "Advanced Settings" section and any related state are removed
