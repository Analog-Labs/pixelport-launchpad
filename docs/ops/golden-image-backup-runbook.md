# Golden Image Backup Runbook

**Purpose:** Keep a local, fail-safe copy of PixelPort golden image and runtime artifacts so we can recover even if a droplet is lost or overwritten.

**Scope:** This runbook covers local artifact storage for stable and canary image snapshots, cloud-init snapshots, manifests, and checksums.

## Canonical Local Backup Root

Use this path as the single local backup root:

`/Users/sanchal/pixelport-artifacts/golden-image-backups`

Recommended subfolders:

- `docker-image-archives/`
- `cloud-init-snapshots/`
- `manifests/`
- `checksums/`

## Create the Directory Layout

```bash
mkdir -p /Users/sanchal/pixelport-artifacts/golden-image-backups/{docker-image-archives,cloud-init-snapshots,manifests,checksums}
```

## Save a Local Docker Image Tar

```bash
docker image save ghcr.io/openclaw/openclaw:2026.3.11 \
  -o /Users/sanchal/pixelport-artifacts/golden-image-backups/docker-image-archives/openclaw-2026.3.11.tar
```

## Pull an Image from a Droplet via SSH and Save Locally

```bash
ssh root@<droplet-host-or-ip> \
  'docker image save ghcr.io/openclaw/openclaw:2026.3.11' \
  > /Users/sanchal/pixelport-artifacts/golden-image-backups/docker-image-archives/openclaw-2026.3.11-from-droplet.tar
```

## Capture a Cloud-Init Snapshot

Store the provisioning input that produced the image alongside the tarball:

```bash
cp infra/provisioning/cloud-init.yaml \
  /Users/sanchal/pixelport-artifacts/golden-image-backups/cloud-init-snapshots/cloud-init-2026.3.11.yaml
```

If you capture generated user-data from a provisioning run, save that exact output in the same folder with a timestamped name.

## Record a Manifest

Keep a short manifest for every backup:

```bash
cat > /Users/sanchal/pixelport-artifacts/golden-image-backups/manifests/openclaw-2026.3.11.manifest.txt <<'EOF'
image=ghcr.io/openclaw/openclaw:2026.3.11
source=droplet-or-local
created=2026-03-18
notes=stable golden image snapshot
EOF
```

## Generate and Verify Checksums

Generate a checksum after each tar is written:

```bash
sha256sum /Users/sanchal/pixelport-artifacts/golden-image-backups/docker-image-archives/openclaw-2026.3.11.tar \
  > /Users/sanchal/pixelport-artifacts/golden-image-backups/checksums/openclaw-2026.3.11.tar.sha256
```

Verify later with:

```bash
sha256sum -c /Users/sanchal/pixelport-artifacts/golden-image-backups/checksums/openclaw-2026.3.11.tar.sha256
```

## Restore an Image

```bash
docker image load \
  -i /Users/sanchal/pixelport-artifacts/golden-image-backups/docker-image-archives/openclaw-2026.3.11.tar
```

After loading, retag if needed before promotion or testing.

## Retention Guidance

- Keep the last 3 stable images.
- Keep the latest canary image.
- Prefer pruning older canaries only after a newer stable backup has been verified.
- Keep matching manifest, cloud-init snapshot, and checksum files for every retained tarball.

## Warning

Do not rely on droplets as the source of truth. Droplets are mutable runtime targets, not durable archives. The local backup root is the fail-safe copy and should be updated whenever an image or provisioning input changes.
