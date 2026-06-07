FROM postgres:18-bookworm

# pg_partman is shipped by PGDG as `postgresql-18-partman`. pgcrypto is in-tree.
RUN apt-get update \
  && apt-get install -y --no-install-recommends postgresql-18-partman \
  && rm -rf /var/lib/apt/lists/*

# Bake the init scripts into the image so a bare `docker run` (CI) provisions the
# partman schema + extensions on first boot. docker-compose bind-mounts the same
# directory over this path; the files are identical, so the overlay is a no-op.
COPY initdb/ /docker-entrypoint-initdb.d/
