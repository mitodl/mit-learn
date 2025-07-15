# Keycloak and APISIX Integration

The "docker-compose.services.yml" file includes Keycloak and APISIX containers
that you can use for authentication instead of spinning up separate ones or
using the deployed instances. It's not enabled by default, but you can run it if
you prefer not to run your own Keycloak/APISIX instances.

## Default Settings

There are some defaults that are part of this.

_SSL Certificate_: There's a self-signed cert that's in `config/keycloak/tls` -
if you'd rather set up your own (or you have a real cert or something to use),
you can drop the PEM files in there. See the README there for info.

_Realm_: There's a `ol-local-realm.json` in `config/keycloak` that will get
loaded by Keycloak when it starts up, and will set up a realm for you with some
users and a client so you don't have to set it up yourself. The realm it creates
is called `ol-local`.

The users it sets up are:

| User                | Password  |
| ------------------- | --------- |
| `student@odl.local` | `student` |
| `prof@odl.local`    | `prof`    |
| `admin@odl.local`   | `admin`   |

The client it sets up is called `apisix`. You can change the passwords and get
the secret in the admin.

## Making it Work

The Keycloak instance is part of the `keycloak` profile in the Composer file, so
be sure that you have the following set in your .env file:
`COMPOSE_PROFILES=backend,frontend,keycloak,apisix`. (If you
start the app without the profile, you can still start Keycloak later by
specifying the profile.)

When you run `docker compose up`, the Keycloak and APISIX containers should start up.
APISIX is on port 8065, Keycloak on port 8066. Now you should be able to log in at
`https://open.odl.local:8065/login` with one of the users mentioned above, or
just click "Log in" from the home page at http://open.odl.local:8062. Try
logging out and back in a couple times to make sure it works.

Keycloak is enabled by default. If you do NOT want to use the Keycloak and APISIX instances,
follow these steps:

1. Change the value of `MITOL_API_BASE_URL` to `http://api.open.odl.local:8063`
   in your `shared.local.env` file.
2. Add `DISABLE_APISIX_USER_MIDDLEWARE=True` to your `backend.local.env` file
3. Set `COMPOSE_PROFILES=backend,frontend` in your .env file

### MITx Online integration

The user dashboard at `/dashboard` includes some integration with the MITx Online
application (https://github.com/mitodl/mitxonline). In order for the same session to
be shared between the two applications, they need to both be accessed through the same
instance of APISIX. The dev APISIX configuration (`config/apisix/apisix.yaml`) includes
two routes:

- MITx Online frontend: Set by `MITX_ONLINE_DOMAIN`, defaulting to `mitxonline.odl.local`, accessed through http://mitxonline.odl.local:8065/
- Path prefixed API: Set by `MITOL_API_DOMAIN`, defaulting to `open.odl.local`, accessed through http://open.odl.local:8065/mitxonline/

For local development you will need to configure some local DNS entries in your hosts file,
pointing them at your local IP address. This is necessary so that the APISIX container can
reach out to both the Learn Django server as well as the MITx Online Django server as upstreams.

Here is an example of what the `hosts` entries might look like, assuming a local IP of 192.168.1.50:

```
192.168.1.50 open.odl.local
192.168.1.50 api.open.odl.local
192.168.1.50 kc.ol.local
192.168.1.50 mitxonline.odl.local
```

In your MITx Online application, you will also need to set all the `KEYCLOAK_` prefixed env vars
to be the same as they are here in MIT Learn. You will also need to set `CORS_ALLOWED_ORIGINS`,
`CSRF_TRUSTED_ORIGINS`, `ALLOWED_REDIRECT_HOSTS` and `SOCIAL_AUTH_ALLOWED_REDIRECT_HOSTS` in both
apps to allow them to communicate with one another.
