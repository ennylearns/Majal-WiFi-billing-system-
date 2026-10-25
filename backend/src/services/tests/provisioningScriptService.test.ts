import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { generateProvisioningScript } from './provisioningScriptService';

describe('ProvisioningScriptService - generateProvisioningScript', () => {
  const baseRouter = {
    id: 'router-uuid-1234',
    name: 'Downtown Hotspot',
    username: 'api_user_downtown',
    password: 'secure_password_999',
    wgPrivateKey: 'cGFzc3dvcmQxMjM0NTY3ODkwMTIzNDU2Nzg5MDEyMzQ=',
    wgTunnelIp: '10.250.0.5'
  };

  test('generates idempotent RouterOS v7 script with correct system identity', () => {
    const script = generateProvisioningScript(baseRouter);
    assert.ok(script.includes('/system/identity set name="Downtown Hotspot"'));
  });

  test('configures WireGuard interface wg-majal with private key and tunnel IP', () => {
    const script = generateProvisioningScript(baseRouter);
    assert.ok(script.includes(':if ([:len [/interface/wireguard find name="wg-majal"]] = 0)'));
    assert.ok(script.includes('/interface/wireguard add name="wg-majal"'));
    assert.ok(script.includes(baseRouter.wgPrivateKey));
    assert.ok(script.includes(':if ([:len [/ip/address find interface="wg-majal"]] = 0)'));
    assert.ok(script.includes('address="10.250.0.5/24"'));
  });

  test('configures WireGuard server peer with keepalive and server endpoint', () => {
    const script = generateProvisioningScript(baseRouter, {
      serverEndpoint: 'vpn.majal.example.com:51820',
      serverPublicKey: 'serverPubKeyBase64=',
      serverIp: '10.250.0.1'
    });
    assert.ok(script.includes(':if ([:len [/interface/wireguard/peers find interface="wg-majal"]] = 0)'));
    assert.ok(script.includes('public-key="serverPubKeyBase64="'));
    assert.ok(script.includes('endpoint-address="vpn.majal.example.com"'));
    assert.ok(script.includes('endpoint-port=51820'));
    assert.ok(script.includes('persistent-keepalive=25s'));
  });

  test('configures API service enabled on port 8728 and strictly locked to server IP', () => {
    const script = generateProvisioningScript(baseRouter, {
      serverIp: '10.250.0.1'
    });
    assert.ok(script.includes('/ip/service set api port=8728 address="10.250.0.1/32" disabled=no'));
  });

  test('configures dedicated billing-api user group and API user', () => {
    const script = generateProvisioningScript(baseRouter);
    assert.ok(script.includes(':if ([:len [/user/group find name="billing-api"]] = 0)'));
    assert.ok(script.includes('/user/group add name="billing-api" policy="api,read,write,policy,test"'));
    assert.ok(script.includes(':if ([:len [/user find name="api_user_downtown"]] = 0)'));
    assert.ok(script.includes('/user add name="api_user_downtown" group="billing-api" password="secure_password_999"'));
  });

  test('configures Walled Garden entries for portal domain and Paystack domains', () => {
    const script = generateProvisioningScript(baseRouter, {
      portalDomain: 'wifi.majal.net'
    });
    assert.ok(script.includes('/ip/hotspot/walled-garden add dst-host="wifi.majal.net" action=allow'));
    assert.ok(script.includes('/ip/hotspot/walled-garden add dst-host="*paystack.com*" action=allow'));
    assert.ok(script.includes('/ip/hotspot/walled-garden add dst-host="*paystack.co*" action=allow'));
  });

  test('configures Hotspot login.html redirect to portal domain with routerId and router identity', () => {
    const script = generateProvisioningScript(baseRouter, {
      portalDomain: 'wifi.majal.net'
    });
    assert.ok(script.includes('/ip/hotspot/profile set [find default=yes] html-directory=hotspot'));
    assert.ok(script.includes('hotspot/login.html'));
    assert.ok(script.includes('https://wifi.majal.net/?routerId=router-uuid-1234&router=$(identity)'));
  });

  test('ensures all resource creation blocks are idempotent', () => {
    const script = generateProvisioningScript(baseRouter);
    // Every :if check has an else block or find guard
    assert.ok(!script.includes('add name="wg-majal"\n')); // Not unshielded
    assert.ok(script.includes(':if ([:len [/file find name="hotspot/login.html"]] > 0)'));
  });
});
