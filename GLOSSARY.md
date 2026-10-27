# Majal WiFi Billing System

Billing and captive portal management system for micro-ISP and hotspot operations.

## Language

**Payment**:
A financial transaction record tracking the user's purchase of an internet plan from initiation through gateway settlement.
_Avoid_: Transaction, checkout record

**Payment Gateway**:
An external payment processing adapter that processes customer funds and provides settlement notifications.
_Avoid_: Payment provider, billing aggregator

**Fulfillment**:
The automated process of activating network access (creating an active session and notifying the user) once payment settlement is confirmed.
_Avoid_: Activation, completion flow
