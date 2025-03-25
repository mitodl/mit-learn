# Using Unified Ecommerce's Keycloak with Learn

You can use the UE pack-in Keycloak instance with Learn, so they share a common SSO system. It's only a few steps to do this.

## Docker Compose setup

The UE Keycloak instance needs to know about the Learn network. So, create a `docker-compose.override.yml` in UE:

```
services:
  keycloak:
    networks:
      default:
        priority: 1000

      mit-open_default:
        aliases:
        - ${KEYCLOAK_SVC_HOSTNAME:-kc.odl.local}

networks:
  mit-open_default:
    external: true
```

Replace `mit-open_default` with the network name for your Learn instance. Do `docker network ls` to find this - it's usually the project name plus `_default`.

This does a couple things:

- Sets the default network to have higher priority than the Learn one.
- Adds an alias for the Keycloak instance to the Learn network.

And there's one consideration: because this links UE to your Learn instance's network, if you `docker compose down` and it brings the Learn network down, your UE instance will not start. Make sure you have Learn running before you start UE.

## App Setup

_Optional:_ If you want, you can set up a separate client for Learn. You don't have to do this - it can use the `apisix` client that is already set up.

Set your Learn instance's `.env` file appropriately for the UE Keycloak instance:

```
DISABLE_APISIX_USER_MIDDLEWARE=False
OIDC_ENDPOINT=http://kc.odl.local:7080/realms/ol-local
SOCIAL_AUTH_OL_OIDC_OIDC_ENDPOINT=http://kc.odl.local:7080/realms/ol-local
SOCIAL_AUTH_OL_OIDC_KEY=apisix
SOCIAL_AUTH_OL_OIDC_SECRET=<the secret you use>
AUTHORIZATION_URL=http://kc.odl.local:7080/realms/ol-local/protocol/openid-connect/auth
ACCESS_TOKEN_URL=http://kc.odl.local:7080/realms/ol-local/protocol/openid-connect/token
USERINFO_URL=http://kc.odl.local:7080/realms/ol-local/protocol/openid-connect/userinfo
KEYCLOAK_BASE_URL=http://kc.odl.local:7080
KEYCLOAK_REALM_NAME=ol-local
```

These URLs should _generally_ work but you may need to verify them (sometimes Keycloak moves them between versions). Note that these all use the _bare HTTP_ endpoints for Keycloak. Unless you've put a real certificate on your Keycloak instance, the Learn app will not be able to communicate with it over HTTPS.

Next, set your UE instance's `.env` file appropriately. UE should use the same hostname and scheme to connect to Keycloak that Learn uses so they can share sessions. So, if you were using HTTPS for Keycloak in UE, change that to HTTP.

## Bring Everything Up

Stop everything if you haven't already. Then, bring up Learn first, followed by UE. (Don't forget the Keycloak profile.)

You should be able to now log into Learn using the Keycloak instance, and navigating into UE should use that same session. If you log out of Learn, or log out and back in as a different user, that state should follow into UE too.
