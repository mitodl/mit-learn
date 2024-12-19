import os

import hvac

# Configuration for Vault
VAULT_ADDR = "http://localhost:8200"
VAULT_OIDC_CLIENT_ID = "your_oidc_client_id"
VAULT_OIDC_ISSUER_URL = "https://your-oidc-issuer-url"

# Static variables
STATIC_VARIABLES = {"API_KEY": "static_api_key", "DATABASE_URL": "static_database_url"}


def get_secret_from_vault(path):
    client = hvac.Client(url=VAULT_ADDR)
    token = client.auth.oidc.login(role="your_oidc_role", jwt=os.environ["JWT"])[
        "auth"
    ]["client_token"]

    client.token = token
    secret = client.secrets.kv.v2.read_secret_version(path=path)["data"]["data"]
    return secret


def generate_env_file(env_path):
    with open(env_path, "w") as env_file:
        for key, value in STATIC_VARIABLES.items():
            env_file.write(f"{key}={value}\n")

        # Add secrets from Vault
        vault_secrets = {
            "SECRET_KEY": get_secret_from_vault("secret/key"),
            "PASSWORD": get_secret_from_vault("secret/password"),
        }

        for key, value in vault_secrets.items():
            env_file.write(f"{key}={value}\n")


if __name__ == "__main__":
    env_path = ".env"
    generate_env_file(env_path)
    print(f"Environment file generated at {env_path}")
