## k6 load testing

### Usage (Docker)

```shell
./scripts/k6.sh /app/learn.smoke.ts -e BACKEND_BASE_URL=#### -e FRONTEND_BASE_URL=####
```

### Usage (local k6)

- Install [k6](https://grafana.com/docs/k6/latest/set-up/install-k6/)

```shell
k6 run learn.smoke.ts -e BACKEND_BASE_URL=#### -e FRONTEND_BASE_URL=####
```

### Available tests

**Note: the numbers for average-load/stress should be updated over time**

- `learn.smoke.ts` - for lightweight smoke testing of deployments (4 users)
- `learn.average-load.ts` - simulates an average amount of user load (100 users)
- `learn.stress.ts` - simulates a stressful amount of user load (200 users)

### Environment Variables

**Note: for base urls, if you access the services via a port, include the port number**

| Name                  | Decription                                                                                                                                                                                  | Example value                 |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| `BACKEND_BASE_URL`    | The base url to the backend API service.                                                                                                                                                    | `https://api.learn.odl.local` |
| `FRONTEND_BASE_URL`   | The base url to the frontend service.                                                                                                                                                       | `https://learn.odl.local`     |
| `SSO_BASE_URL`        | The base url to the keycloak service.                                                                                                                                                       | `https://keycloak.odl.local`  |
| `IGNORE_HTTPS_ERRORS` | Ignore https certificate errors. Only recommemded for local test certificates.                                                                                                              | `true`                        |
| `USERS_JSON_FILE`     | Data file for users auth info. Expected to be in the format `[{"email": "<EMAIL>", "password": "<PASSWORD>"}, ...]`. Put this is the `data/` subdirectory as files in there are gitignored. | `data/users.json`             |
