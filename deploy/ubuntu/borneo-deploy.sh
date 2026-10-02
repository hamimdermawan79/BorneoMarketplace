#!/usr/bin/env bash
# Install as root:root 0755 at /usr/local/sbin/borneo-deploy.
# Execute only after provisioning the users, database, repository and secrets.
# Never source a script or environment file from a release with root privileges.
set -euo pipefail
export PATH=/usr/local/bin:/usr/bin:/bin
umask 022
[[ "$EUID" -eq 0 && "$#" -eq 1 && "$1" =~ ^[a-f0-9]{40}$ ]] || {
  echo 'Usage: sudo /usr/local/sbin/borneo-deploy <40-character-main-commit-sha>' >&2
  exit 1
}
sha="$1"
base=/opt/borneo-marketplace
repository="$base/repository.git"
exec 9>/run/lock/borneo-marketplace-deploy.lock
flock -n 9 || { echo 'Another deployment is running.' >&2; exit 1; }
[[ -d "$repository" && -d "$base/releases" ]]
[[ -f /etc/borneo-marketplace/runtime.env && -f /etc/borneo-marketplace/maintenance.env ]]
[[ ! -e "$base/current" || -L "$base/current" ]] || {
  echo 'current must be a managed release symlink; refusing to replace an existing directory.' >&2
  exit 1
}
fetch_main() {
  git --git-dir="$repository" fetch --no-tags origin '+refs/heads/main:refs/heads/main'
}
fetch_main
if [[ "$(git --git-dir="$repository" rev-parse refs/heads/main)" != "$sha" ]]; then
  echo 'Skipping an outdated workflow: main has a newer commit.'
  exit 0
fi
previous=''
if [[ -L "$base/current" ]]; then
  previous="$(readlink -f "$base/current")"
  [[ "$previous" =~ ^/opt/borneo-marketplace/releases/[a-f0-9]{40}-[0-9TZ]+$ ]]
  [[ -f "$previous/apps/api/dist/server.js" ]]
fi
stamp="$(date -u +%Y%m%dT%H%M%S)Z"
release="$base/releases/$sha-$stamp"
mkdir -- "$release"
git --git-dir="$repository" archive "$sha" | tar -x -C "$release"
chown -R borneo-build:borneo-build "$release"
runuser -u borneo-build -- /bin/bash -c 'cd "$1" && npm ci && npm test && npm run build' bash "$release"
# The API and SSH user cannot edit the published application code.
chown -R root:root "$release"
chmod -R go-w "$release"
[[ -f "$release/apps/web/dist/index.html" && -f "$release/apps/api/dist/server.js" ]]
fetch_main
if [[ "$(git --git-dir="$repository" rev-parse refs/heads/main)" != "$sha" ]]; then
  echo 'Built release retained, but skipped: main changed during the build.'
  exit 0
fi

stopped=false
switched=false
recover() {
  status="$?"
  trap - EXIT
  if ((status != 0)) && [[ "$stopped" == true ]]; then
    systemctl stop borneo-api || true
    if [[ -n "$previous" ]]; then
      if [[ "$switched" == true ]]; then
        ln -sT "$previous" "$base/current.recover"
        mv -Tf "$base/current.recover" "$base/current"
      fi
      systemctl start borneo-api || true
    else
      systemctl stop borneo-api || true
      # No previous version exists on a failed first deployment.
      if [[ "$switched" == true ]]; then unlink "$base/current"; fi
    fi
    echo 'Deployment failed. Previous code restored where available; database migrations are NOT automatically reversed. Review journal and backup before recovery.' >&2
  fi
  exit "$status"
}
trap recover EXIT

systemctl stop borneo-api
stopped=true
# With the API stopped, database and media backups refer to a stable application state.
# Provision pg_dump matching the PostgreSQL server major version.
backup=/var/backups/borneo-marketplace
install -d -m 0700 -o root -g root "$backup"
runuser -u postgres -- pg_dump --format=custom borneo_marketplace > "$backup/$stamp-$sha.dump"
chmod 0600 "$backup/$stamp-$sha.dump"
[[ -s "$backup/$stamp-$sha.dump" ]]
tar -czf "$backup/$stamp-$sha.media.tar.gz" -C /var/lib/borneo-marketplace produk
chmod 0600 "$backup/$stamp-$sha.media.tar.gz"

# Schema owner credentials are available ONLY to a non-root maintenance process.
# Migrations must include reviewed grants for new tables and remain compatible with
# the previous release. Bootstrap/seed/reset never run during an update.
systemd-run --quiet --wait --pipe --collect \
  --property=User=borneo-maintenance --property=Group=borneo-maintenance \
  --property=EnvironmentFile=/etc/borneo-marketplace/maintenance.env \
  --property=NoNewPrivileges=yes --property=ProtectHome=yes --property=ProtectSystem=strict --property=PrivateTmp=yes \
  --working-directory="$release" \
  /usr/local/bin/node --import tsx apps/api/src/database/migrate.ts

ln -sT "$release" "$base/current.next"
mv -Tf "$base/current.next" "$base/current"
switched=true
systemctl start borneo-api
healthy=false
for attempt in {1..30}; do
  if curl --fail --silent --max-time 2 http://127.0.0.1:4000/api/health | grep -q '"status":"ok"'; then
    healthy=true
    break
  fi
  sleep 1
done
[[ "$healthy" == true ]]
echo "Deployed $sha. Database/media backup and previous releases retained."
