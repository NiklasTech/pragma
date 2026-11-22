# Containers

The **Docker** view in the sidebar of the code tab lists your containers. Open it from the `⋯` button at the top of the sidebar. Pragma works with Docker and with Podman and finds either one on its own.

## Containers

The containers are grouped into **Project**, the ones that belong to the open folder, and **Other**. Each container has these actions:

| Action  | What it does                               |
| ------- | ------------------------------------------ |
| Start   | Starts a stopped container                 |
| Stop    | Stops a running container                  |
| Restart | Restarts the container                     |
| Logs    | Shows the container's output in a terminal |
| Shell   | Opens a shell inside the running container |

**Refresh** reads the list again.

## Docker Compose

When the project has a `docker-compose.yml`, `docker-compose.yaml`, `compose.yml` or `compose.yaml` at its root, the view offers the Compose actions for the whole project: **Up**, **Down**, **Build** and **Restart**.

## When nothing shows

- **Docker not available**: neither Docker nor Podman was found. Install one of them and make sure its program is on your `PATH`.
- **Docker detection failed**: the program was found but did not answer. Start Docker Desktop or the Podman machine and press **Refresh**.
- **No containers found**: the runtime works, but no container exists yet.
