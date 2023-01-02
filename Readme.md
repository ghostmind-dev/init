# post-create

post-create script for devcontainer

## install

```bash
npm install @ghostmind-dev/post-create
```

## environment variable

| name                       | default value | description                                               |
| -------------------------- | ------------- | --------------------------------------------------------- |
| `EXPORT_PROJECT_ENV`       | `false`       | export project environment from vault to .env             |
| `INSTALL_DEV_DEPENDENCIES` | `false`       | install all dev dependencies for all project folders      |
| `RESET_LIVE_RUN`           | `false`       | remove and reinstall local run repository (liver command) |
| `SET_NPM_CREDENTIALS`      | `false`       | set npm environment                                       |
| `SET_GCP_CREDENTIALS`      | `false`       | set gcp environment                                       |
| `SET_GAM_CREDENTIALS`      | `false`       | set gam environment                                       |
