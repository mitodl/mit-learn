## k6 load testing

### Usage (Docker)

```shell
./scripts/k6.sh -e BACKEND_BASE_URL=#### -e FRONTEND_BASE_URL=####
```

### Usage (local k6)

- Install [k6](https://grafana.com/docs/k6/latest/set-up/install-k6/)

```shell
k6 run learn.ts -e BACKEND_BASE_URL=#### -e FRONTEND_BASE_URL=####
```
