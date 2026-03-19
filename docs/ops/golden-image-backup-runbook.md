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
  'docker save pixelport-paperclip:2026.3.11-handoff-p1 | gzip -1' \
  > /Users/sanchal/pixelport-artifacts/golden-image-backups/docker-image-archives/2026-03-18-pixelport-paperclip-2026.3.11-handoff-p1.tar.gz
```

## Capture a Cloud-Init Snapshot

Store the provisioning input that produced the image alongside the tarball:

```bash
cp /Users/sanchal/pixelport-launchpad/api/inngest/functions/provision-tenant.ts \
  /Users/sanchal/pixelport-artifacts/golden-image-backups/cloud-init-snapshots/2026-03-18-provision-tenant-source.ts
```

If you capture generated user-data from a provisioning run, save that exact output in the same folder with a timestamped name.

## Record a Manifest

Keep a short manifest for every backup:

```bash
cat > /Users/sanchal/pixelport-artifacts/golden-image-backups/manifests/2026-03-18-pixelport-paperclip-2026.3.11-handoff-p1.manifest.txt <<'EOF'
image=pixelport-paperclip:2026.3.11-handoff-p1
source_host=157.230.10.108
source_type=droplet
created=2026-03-18
notes=experimental paperclip runtime image backup
EOF
```

## Generate and Verify Checksums

Generate a checksum after each tar is written (macOS + Linux-safe):

```bash
shasum -a 256 /Users/sanchal/pixelport-artifacts/golden-image-backups/docker-image-archives/2026-03-18-pixelport-paperclip-2026.3.11-handoff-p1.tar.gz \
  > /Users/sanchal/pixelport-artifacts/golden-image-backups/checksums/2026-03-18-pixelport-paperclip-2026.3.11-handoff-p1.sha256
```

Verify later with:

```bash
shasum -a 256 -c /Users/sanchal/pixelport-artifacts/golden-image-backups/checksums/2026-03-18-pixelport-paperclip-2026.3.11-handoff-p1.sha256
```

## Restore an Image

```bash
docker image load \
  -i /Users/sanchal/pixelport-artifacts/golden-image-backups/docker-image-archives/2026-03-18-pixelport-paperclip-2026.3.11-handoff-p1.tar.gz
```

After loading, retag if needed before promotion or testing.

## Known Good Backup Artifacts (2026-03-18)

- `docker-image-archives/2026-03-18-pixelport-paperclip-2026.3.11-handoff-p1.tar.gz`
- `checksums/2026-03-18-pixelport-paperclip-2026.3.11-handoff-p1.sha256`
- `manifests/2026-03-18-pixelport-paperclip-2026.3.11-handoff-p1.manifest.txt`
- `cloud-init-snapshots/2026-03-18-provision-tenant-source.ts`
- `cloud-init-snapshots/2026-03-18-snapshot-notes.txt`

## Known Good Backup Artifacts (2026-03-19, P6 R2)

- `manifests/2026-03-19-p6-r2-openclaw-2026.3.13-1.manifest.txt`
- `cloud-init-snapshots/2026-03-19-p6-r2-openclaw-2026.3.13-1-provision-tenant.ts`
- `checksums/2026-03-19-p6-r2-openclaw-2026.3.13-1.manifest.sha256`
- `checksums/2026-03-19-p6-r2-openclaw-2026.3.13-1.provision-tenant.sha256`
- `evidence/2026-03-19-p6-r2-openclaw-2026.3.13-1-*.json`

## Known Good Backup Artifacts (2026-03-19, P6 R3)

- `manifests/2026-03-19-p6-r3-paperclip-v2026.318.0.manifest.txt`
- `cloud-init-snapshots/2026-03-19-p6-r3-paperclip-v2026.318.0-provision-tenant.ts`
- `checksums/2026-03-19-p6-r3-paperclip-v2026.318.0.manifest.sha256`
- `checksums/2026-03-19-p6-r3-paperclip-v2026.318.0.provision-tenant.sha256`
- `evidence/2026-03-19-p6-r3-paperclip-v2026.318.0-*.json`
- `evidence/2026-03-19-p6-r3-paperclip-v2026.318.0-*.log`

## Retention Guidance

- Keep the last 3 stable images.
- Keep the latest canary image.
- Prefer pruning older canaries only after a newer stable backup has been verified.
- Keep matching manifest, cloud-init snapshot, and checksum files for every retained tarball.

## Warning

Do not rely on droplets as the source of truth. Droplets are mutable runtime targets, not durable archives. The local backup root is the fail-safe copy and should be updated whenever an image or provisioning input changes.
