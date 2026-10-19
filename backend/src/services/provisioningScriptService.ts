import wireguardService from './wireguardService';

export interface ProvisioningRouterInfo {
  id: string;
  name: string;
  username: string;
  password: string;
  wgPrivateKey?: string | null;
  wgTunnelIp?: string | null;
}

export interface ProvisioningScriptOptions {
  serverEndpoint?: string;
  serverPublicKey?: string;
  serverIp?: string;
  portalDomain?: string;
  tunnelSubnet?: string;
}

/**
 * Generate an idempotent RouterOS v7 provisioning script for a given Router.
 * Configures:
 * 1. System identity
 * 2. WireGuard client interface (`wg-majal`) with assigned tunnel IP
 * 3. WireGuard server peer with persistent-keepalive=25s
 * 4. API service restricted strictly to server tunnel IP
 * 5. Dedicated `billing-api` user and group
 * 6. Walled garden entries for portal domain and Paystack
 * 7. Hotspot login.html redirecting to portal domain with routerId and router identity
 */
export function generateProvisioningScript(
  router: ProvisioningRouterInfo,
  options?: ProvisioningScriptOptions
): string {
  const portalDomain =
    options?.portalDomain ||
    process.env.PORTAL_DOMAIN ||
    'wifi.majal.example.com';

  const rawServerEndpoint =
    options?.serverEndpoint ||
    wireguardService.getServerEndpoint() ||
    process.env.WIREGUARD_SERVER_ENDPOINT ||
    'vpn.majal.example.com:51820';

  let endpointAddress = rawServerEndpoint;
  let endpointPort = '51820';
  if (rawServerEndpoint.includes(':')) {
    const parts = rawServerEndpoint.split(':');
    endpointAddress = parts[0];
    endpointPort = parts[1] || '51820';
  }

  const serverPublicKey =
    options?.serverPublicKey ||
    wireguardService.getServerPublicKey() ||
    process.env.WIREGUARD_SERVER_PUBLIC_KEY ||
    '';

  const serverIp =
    options?.serverIp ||
    wireguardService.getServerIp() ||
    '10.250.0.1';

  const tunnelSubnet =
    options?.tunnelSubnet ||
    wireguardService.getSubnet() ||
    '10.250.0.0/24';

  const wgPrivateKey = router.wgPrivateKey || '';
  const wgTunnelIp = router.wgTunnelIp || '10.250.0.2';
  const cleanTunnelIp = wgTunnelIp.split('/')[0];

  const htmlContent = `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0; url=https://${portalDomain}/?routerId=${router.id}&router=$(identity)"><script>window.location.href='https://${portalDomain}/?routerId=${router.id}&router=$(identity)';</script></head><body>Redirecting to portal...</body></html>`;

  return `# --------------------------------------------------
# Majal WiFi Billing System - RouterOS v7 Provisioning Script
# Router Name: ${router.name}
# Router ID: ${router.id}
# Generated: ${new Date().toISOString()}
# --------------------------------------------------

# 1. System Identity
/system/identity set name="${router.name}"

# 2. WireGuard Client Interface & Address
:if ([:len [/interface/wireguard find name="wg-majal"]] = 0) do={
    /interface/wireguard add name="wg-majal" listen-port=13231 private-key="${wgPrivateKey}"
} else={
    /interface/wireguard set [find name="wg-majal"] private-key="${wgPrivateKey}" listen-port=13231
}

:if ([:len [/ip/address find interface="wg-majal"]] = 0) do={
    /ip/address add address="${cleanTunnelIp}/24" interface="wg-majal"
} else={
    /ip/address set [find interface="wg-majal"] address="${cleanTunnelIp}/24"
}

# 3. WireGuard Server Peer
:if ([:len [/interface/wireguard/peers find interface="wg-majal"]] = 0) do={
    /interface/wireguard/peers add interface="wg-majal" public-key="${serverPublicKey}" endpoint-address="${endpointAddress}" endpoint-port=${endpointPort} allowed-address="${tunnelSubnet}" persistent-keepalive=25s
} else={
    /interface/wireguard/peers set [find interface="wg-majal"] public-key="${serverPublicKey}" endpoint-address="${endpointAddress}" endpoint-port=${endpointPort} allowed-address="${tunnelSubnet}" persistent-keepalive=25s
}

# 4. API Service Lockdown
/ip/service set api port=8728 address="${serverIp}/32" disabled=no

# 5. Dedicated API User and Group
:if ([:len [/user/group find name="billing-api"]] = 0) do={
    /user/group add name="billing-api" policy="api,read,write,policy,test"
} else={
    /user/group set [find name="billing-api"] policy="api,read,write,policy,test"
}

:if ([:len [/user find name="${router.username}"]] = 0) do={
    /user add name="${router.username}" group="billing-api" password="${router.password}"
} else={
    /user set [find name="${router.username}"] group="billing-api" password="${router.password}"
}

# 6. Hotspot Walled Garden (Portal & Paystack)
:if ([:len [/ip/hotspot/walled-garden find dst-host="${portalDomain}"]] = 0) do={
    /ip/hotspot/walled-garden add dst-host="${portalDomain}" action=allow
}
:if ([:len [/ip/hotspot/walled-garden find dst-host="*paystack.com*"]] = 0) do={
    /ip/hotspot/walled-garden add dst-host="*paystack.com*" action=allow
}
:if ([:len [/ip/hotspot/walled-garden find dst-host="*paystack.co*"]] = 0) do={
    /ip/hotspot/walled-garden add dst-host="*paystack.co*" action=allow
}

# 7. Hotspot Profile & Captive Portal Redirect
/ip/hotspot/profile set [find default=yes] html-directory=hotspot
:if ([:len [/file find name="hotspot/login.html"]] > 0) do={
    /file set "hotspot/login.html" contents="${htmlContent}"
} else={
    /file add name="hotspot/login.html" contents="${htmlContent}"
}
`;
}

export default {
  generateProvisioningScript
};
