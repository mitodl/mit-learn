# Keycloak and APISIX Integration

The "docker-compose.services.yml" file includes Keycloak and APISIX containers that you can use for authentication instead of spinning up separate ones or using the deployed instances. It's not enabled by default, but you can run it if you prefer not to run your own Keycloak/APISIX instances.

## Default Settings

There are some defaults that are part of this.

_SSL Certificate_: There's a self-signed cert that's in `config/keycloak/tls` - if you'd rather set up your own (or you have a real cert or something to use), you can drop the PEM files in there. See the README there for info.

_Realm_: There's a `default-realm.json` in `config/keycloak` that will get loaded by Keycloak when it starts up, and will set up a realm for you with some users and a client so you don't have to set it up yourself. The realm it creates is called `ol-local`.

The users it sets up are:

| User                | Password  |
| ------------------- | --------- |
| `student@odl.local` | `student` |
| `prof@odl.local`    | `prof`    |
| `admin@odl.local`   | `admin`   |

The client it sets up is called `apisix`. You can change the passwords and get the secret in the admin.

## Making it Work

The Keycloak instance is part of the `keycloak` profile in the Composer file, so if you want to interact with it, you'll need to run `COMPOSE_PROFILES=backend,frontend,keycloak docker compose up`. (If you start the app without the profile, you can still start Keycloak later by specifying the profile.)

If you want to use the Keycloak and APISIX instances, follow these steps:

1. Change the value of `MITOL_API_BASE_URL` to `http://api.open.odl.local:8065` in your `shared.local.env` file.
2. Copy all the env values under the "# APISIX/Keycloak " section of `backend.local.example.env` to your `backend.local.env` file. You can leave all the values as is.
3. Keycloak needs to create its own database, which will only happen if you first destroy your current mit-learn database container: `docker compose down db`. If you prefer not to do this, you can manually create it by running the SQL in `config/postgres/init-keycloak.sql` in a postgres shell.
4. Start containers with the command `COMPOSE_PROFILES=backend,frontend,keycloak docker compose up`

The Keycloak and APISIX containers should start up and stay running. APISIX is on port 8065, Keycloak on port 8066. Now you should be able to log in at `https://open.odl.local:8065/login` with one of the users mentioned above, or just click "Log in" from the home page at http://open.odl.local:8062. Try logging out and back in a couple times to make sure it works.
