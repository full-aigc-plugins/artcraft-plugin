#!/usr/bin/env python3
"""Vendor externally maintained Agent Skills into this plugin.

The source skill package is the single source of truth. This plugin keeps a
checksummed snapshot so an installed plugin remains complete and usable
without fetching another repository at runtime.

Only skill names listed in ``skills.lock.json`` are managed. Plugin-local
custom skills must be declared separately in ``plugin-local-skills.json``;
they are never removed or overwritten by this tool. Undeclared skill
directories are rejected so a new local exception is always explicit.

Commands:
  update  Fetch pinned sources, replace managed skill directories, and refresh
          resolved commits and per-skill digests.
  check   Verify the snapshot against the lockfile and, unless ``--offline``,
          verify the pinned upstream ref and content.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

SKILL_NAME_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
VERSION_TAG_RE = re.compile(r"^v[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$")
COMMIT_SHA_RE = re.compile(r"^[0-9a-f]{40}$")

# Credentials are keyed by the source repository's owner, not by package name, so
# adding another skill package under an already mapped owner needs no code change.
OWNER_TOKEN_ENV = {
    "full-aigc-skills": "FULL_AIGC_SKILLS_SYNC_TOKEN",
    "full-stack-skills": "FULL_STACK_SKILLS_SYNC_TOKEN",
}
# Comma-separated owners whose sources must authenticate; a missing token then
# fails loudly instead of silently degrading to an anonymous read.
REQUIRE_AUTH_ENV = "SKILL_VENDOR_REQUIRE_AUTH"
# Name of the environment variable the one-shot askpass helper reads at runtime.
TOKEN_ENV_VAR = "SKILL_VENDOR_GIT_TOKEN"

URL_WITH_SCHEME_RE = re.compile(r"^[a-zA-Z][a-zA-Z0-9+.-]*://(?:[^/@]+@)?([^/:]+)/([^/]+)/")
SCP_LIKE_RE = re.compile(r"^(?:[^/@]+@)?([^/:]+):([^/]+)/")

# The helper carries no secret: it reads the token from the child process
# environment, so the token never reaches argv or a persisted git configuration.
ASKPASS_SCRIPT = (
    "#!/bin/sh\n"
    "case \"$1\" in\n"
    "  *[Uu]sername*) printf '%s\\n' \"x-access-token\" ;;\n"
    f"  *) printf '%s\\n' \"${{{TOKEN_ENV_VAR}}}\" ;;\n"
    "esac\n"
)


def redact(message: object) -> str:
    """Scrub any known credential value out of an outgoing message."""
    text = str(message)
    for name in (*set(OWNER_TOKEN_ENV.values()), TOKEN_ENV_VAR, "GH_TOKEN", "GITHUB_TOKEN"):
        secret = os.environ.get(name, "").strip()
        if len(secret) >= 8:
            text = text.replace(secret, "***")
    return text


def fail(message: str) -> None:
    print(f"ERROR: {redact(message)}")


def repo_owner(repo: str) -> str | None:
    """Return the owner segment of a git remote URL, or ``None`` when unparseable."""
    match = URL_WITH_SCHEME_RE.match(repo.strip()) or SCP_LIKE_RE.match(repo.strip())
    return match.group(2) if match else None


def required_auth_owners() -> set[str]:
    """Owners configured to require authentication."""
    raw = os.environ.get(REQUIRE_AUTH_ENV, "")
    return {item.strip() for item in raw.split(",") if item.strip()}


def credential_for(repo: str) -> str | None:
    """Select the credential for one source repository by its owner.

    Unknown owners stay anonymous so public sources keep working. An owner listed
    in ``SKILL_VENDOR_REQUIRE_AUTH`` without a token is an error rather than a
    silent anonymous read, which would disguise an auth failure as a clean sync.
    """
    owner = repo_owner(repo)
    if owner is None:
        return None
    variable = OWNER_TOKEN_ENV.get(owner)
    token = os.environ.get(variable, "").strip() if variable else ""
    if owner in required_auth_owners() and not token:
        raise RuntimeError(
            f"source owner '{owner}' requires authentication but {variable} is not set"
        )
    return token or None


def credential_env(token: str | None, workdir: Path) -> dict[str, str]:
    """Build a subprocess environment that authenticates without persisting secrets."""
    environment = dict(os.environ)
    environment["GIT_TERMINAL_PROMPT"] = "0"
    if not token:
        return environment
    askpass = workdir / "askpass.sh"
    if not askpass.exists():
        askpass.write_text(ASKPASS_SCRIPT, encoding="utf-8")
        askpass.chmod(0o700)
    environment["GIT_ASKPASS"] = str(askpass)
    environment[TOKEN_ENV_VAR] = token
    return environment


def hash_skill_dir(skill_dir: Path) -> str:
    """Return a deterministic digest over every file in one skill."""
    if skill_dir.is_symlink() or skill_dir.parent.is_symlink():
        raise RuntimeError(f"{skill_dir.name}: symbolic link skill root is not self-contained")
    if not skill_dir.is_dir():
        raise RuntimeError(f"{skill_dir.name}: skill directory is missing")
    paths = sorted(skill_dir.rglob("*"))
    # 先检查所有条目，包含目录链接和悬空链接；不能用 is_file() 将它们过滤掉。
    for path in paths:
        if path.is_symlink():
            raise RuntimeError(f"{skill_dir.name}: symbolic link in skill payload: {path.relative_to(skill_dir)}")
        if not path.is_dir() and not path.is_file():
            raise RuntimeError(f"{skill_dir.name}: unsupported entry in skill payload: {path.relative_to(skill_dir)}")
    digest = hashlib.sha256()
    for path in (p for p in paths if p.is_file()):
        relative = path.relative_to(skill_dir).as_posix()
        digest.update(relative.encode("utf-8"))
        digest.update(b"\0")
        digest.update(hashlib.sha256(path.read_bytes()).hexdigest().encode("ascii"))
        digest.update(b"\n")
    return digest.hexdigest()


def resolve_ref(repo: str, ref: str, env: dict[str, str] | None = None) -> str:
    """Resolve only a lightweight/annotated release tag to its commit SHA."""
    tag = f"refs/tags/{ref}"
    result = subprocess.run(
        ["git", "ls-remote", repo, tag, f"{tag}^{{}}"],
        check=True,
        capture_output=True,
        text=True,
        env=env,
    ).stdout.strip()
    if not result:
        raise RuntimeError(f"{repo}: ref '{ref}' not found")

    resolved = None
    for line in result.splitlines():
        candidate, _, remote_name = line.partition("\t")
        if remote_name == f"{tag}^{{}}" or remote_name == tag and resolved is None:
            resolved = candidate
    if resolved is None:
        raise RuntimeError(f"{repo}: could not resolve ref '{ref}'")
    return resolved


def fetch_checkout(repo: str, ref: str, workdir: Path, env: dict[str, str] | None = None) -> Path:
    """Fetch one pinned ref into an isolated checkout.

    The remote is registered with the plain URL and the credential travels in
    ``env`` instead, so no secret is written into the checkout's git configuration.
    """
    checkout = workdir / "checkout"
    subprocess.run(["git", "init", "--quiet", str(checkout)], check=True, env=env)
    subprocess.run(
        ["git", "-C", str(checkout), "remote", "add", "origin", repo], check=True, env=env
    )
    subprocess.run(
        ["git", "-C", str(checkout), "fetch", "--quiet", "--depth", "1", "origin", f"refs/tags/{ref}"],
        check=True,
        env=env,
    )
    subprocess.run(
        ["git", "-C", str(checkout), "checkout", "--quiet", "--detach", "FETCH_HEAD"],
        check=True,
        env=env,
    )
    head = subprocess.run(
        ["git", "-C", str(checkout), "rev-parse", "HEAD"],
        check=True,
        capture_output=True,
        text=True,
        env=env,
    ).stdout.strip()
    print(f"fetched {repo}@{ref} -> {head}")
    return checkout


def load_lock(path: Path) -> dict:
    """Read and validate the lockfile version."""
    lock = json.loads(path.read_text(encoding="utf-8"))
    if lock.get("version") != 1:
        raise RuntimeError(f"unsupported lockfile version: {lock.get('version')}")
    if not isinstance(lock.get("sources"), list) or not lock["sources"]:
        raise RuntimeError("lockfile requires a non-empty sources list")
    return lock


def validate_source(source: dict, root: Path) -> Path:
    """Validate one source entry and return its safe destination."""
    for key in ("package", "repo", "ref", "skills", "dest"):
        if key not in source:
            raise RuntimeError(f"source {source.get('package', '?')}: missing key '{key}'")
    if not isinstance(source["skills"], list) or not source["skills"]:
        raise RuntimeError(f"{source['package']}: skills must be a non-empty list")
    if not isinstance(source["ref"], str) or not VERSION_TAG_RE.match(source["ref"]):
        raise RuntimeError(f"{source['package']}: ref must be an immutable semantic version tag")
    if len(source["skills"]) != len(set(source["skills"])):
        raise RuntimeError(f"{source['package']}: duplicate skill names in lock entry")
    for name in source["skills"]:
        if not isinstance(name, str) or not SKILL_NAME_RE.match(name):
            raise RuntimeError(f"{source['package']}: illegal skill name '{name}'")

    sha = source.get("sha")
    if not isinstance(sha, str) or not COMMIT_SHA_RE.fullmatch(sha):
        raise RuntimeError(f"{source['package']}: locked commit must be a 40-character SHA")
    digests = source.get("sha256")
    if not isinstance(digests, dict) or set(digests) != set(source["skills"]) or any(
        not isinstance(value, str) or not re.fullmatch(r"[0-9a-f]{64}", value)
        for value in digests.values()
    ):
        raise RuntimeError(f"{source['package']}: locked digests must cover every declared skill with SHA-256")

    unresolved = root / source["dest"]
    destination = unresolved.resolve()
    if root != destination and root not in destination.parents:
        raise RuntimeError(f"{source['package']}: dest escapes repository root")
    for path in (unresolved, *unresolved.parents):
        if path == root:
            break
        if path.is_symlink():
            raise RuntimeError(f"{source['package']}: symbolic link destination is not self-contained")
    return destination


def validate_plugin_local_inventory(root: Path, lock: dict) -> None:
    """Require every unvendorized skill to be declared in a separate policy file."""
    policy_path = root / "plugin-local-skills.json"
    if not policy_path.is_file():
        raise RuntimeError("plugin-local-skills.json is required")
    policy = json.loads(policy_path.read_text(encoding="utf-8"))
    if policy.get("version") != 1:
        raise RuntimeError("unsupported plugin-local-skills.json version")
    if not isinstance(policy.get("dest"), str):
        raise RuntimeError("plugin-local-skills.json requires a dest string")
    names = policy.get("skills")
    if not isinstance(names, list):
        raise RuntimeError("plugin-local-skills.json requires a skills list")
    if len(names) != len(set(names)):
        raise RuntimeError("plugin-local-skills.json contains duplicate skill names")
    for name in names:
        if not isinstance(name, str) or not SKILL_NAME_RE.match(name):
            raise RuntimeError(f"plugin-local-skills.json contains illegal skill name '{name}'")

    destination = (root / policy["dest"]).resolve()
    if root != destination and root not in destination.parents:
        raise RuntimeError("plugin-local-skills.json dest escapes repository root")
    managed = {
        name
        for source in lock["sources"]
        if (root / source.get("dest", "")).resolve() == destination
        for name in source.get("skills", [])
    }
    overlap = sorted(managed & set(names))
    if overlap:
        raise RuntimeError(
            "plugin-local skills must not appear in skills.lock.json: " + ", ".join(overlap)
        )
    actual = {
        path.name
        for path in destination.iterdir()
        if path.is_dir() and (path / "SKILL.md").is_file()
    } if destination.is_dir() else set()
    undeclared = sorted(actual - managed - set(names))
    missing = sorted(set(names) - actual)
    if undeclared:
        raise RuntimeError(
            "undeclared plugin-local skills; add them to plugin-local-skills.json: "
            + ", ".join(undeclared)
        )
    if missing:
        raise RuntimeError(
            "declared plugin-local skills are missing from the tree: " + ", ".join(missing)
        )


def validate_no_cross_source_collisions(lock: dict) -> None:
    """Reject two upstream sources that manage the same destination skill."""
    owners: dict[tuple[str, str], str] = {}
    for source in lock["sources"]:
        names = source.get("skills", [])
        if len(names) != len(set(names)):
            raise RuntimeError(
                f"{source.get('package', '?')}: duplicate skill names in lock entry"
            )
        for name in names:
            key = (source.get("dest", ""), name)
            previous = owners.get(key)
            if previous:
                raise RuntimeError(
                    f"skill collision: {name} is managed by both {previous} and {source.get('package')}"
                )
            owners[key] = source.get("package", "?")


def source_checkout(source: dict, overrides: dict[str, str], workdir: Path) -> tuple[Path, str]:
    """Return ``(checkout, resolved_sha)`` for one source."""
    package = source["package"]
    if package in overrides:
        local = Path(overrides[package]).resolve()
        if not local.is_dir():
            raise RuntimeError(f"{package}: --source-path '{local}' is not a directory")
        # 本地覆盖仅指定 Git 来源；快照必须读取固定标签，不能复制脏工作树或缓存。
        checkout = fetch_checkout(str(local), source["ref"], workdir / package)
        sha = subprocess.run(
            ["git", "-C", str(checkout), "rev-parse", "HEAD"],
            check=True,
            capture_output=True,
            text=True,
        ).stdout.strip()
        print(f"using local tagged source for {package}: {local} @ {sha}")
        return checkout, sha

    environment = credential_env(credential_for(source["repo"]), workdir)
    sha = resolve_ref(source["repo"], source["ref"], environment)
    checkout = fetch_checkout(source["repo"], source["ref"], workdir / package, environment)
    actual_sha = subprocess.run(
        ["git", "-C", str(checkout), "rev-parse", "HEAD"],
        check=True, capture_output=True, text=True, env=environment,
    ).stdout.strip()
    if actual_sha != sha:
        raise RuntimeError(f"{package}: fetched commit differs from resolved ref: {actual_sha} != {sha}")
    return checkout, sha


def validate_assignment_packages(lock: dict, assignments: dict[str, str], option: str) -> None:
    """Reject assignments for sources that are not present in the lockfile."""
    packages = {source["package"] for source in lock["sources"]}
    unknown = sorted(set(assignments) - packages)
    if unknown:
        raise RuntimeError(f"{option} references unknown packages: {', '.join(unknown)}")


def cmd_update(
    lock_path: Path,
    overrides: dict[str, str],
    source_refs: dict[str, str],
    expected_shas: dict[str, str],
) -> int:
    """Refresh every managed skill while preserving plugin-local skills."""
    root = lock_path.parent
    lock = load_lock(lock_path)
    validate_no_cross_source_collisions(lock)
    validate_plugin_local_inventory(root, lock)
    validate_assignment_packages(lock, source_refs, "--source-ref")
    validate_assignment_packages(lock, expected_shas, "--expected-sha")
    for package, ref in source_refs.items():
        if not VERSION_TAG_RE.match(ref):
            raise RuntimeError(f"{package}: --source-ref must be vMAJOR.MINOR.PATCH")
    for package, sha in expected_shas.items():
        if not COMMIT_SHA_RE.match(sha):
            raise RuntimeError(f"{package}: --expected-sha must be a 40-character commit SHA")
    errors = 0

    prepared = []
    with tempfile.TemporaryDirectory(prefix="skill-vendor-") as temporary:
        for source in lock["sources"]:
            package = source["package"]
            if package in source_refs:
                source["ref"] = source_refs[package]
            destination = validate_source(source, root)
            try:
                checkout, sha = source_checkout(source, overrides, Path(temporary))
            except (RuntimeError, subprocess.CalledProcessError) as error:
                fail(f"{source['package']}: {error}")
                errors += 1
                continue

            expected_sha = expected_shas.get(package)
            if expected_sha and sha != expected_sha:
                fail(
                    f"{package}: {source['ref']} resolved to {sha}, "
                    f"expected dispatched commit {expected_sha}"
                )
                errors += 1
                continue

            digests = {}
            for name in source["skills"]:
                source_skill = checkout / "skills" / name
                if (checkout / "skills").is_symlink():
                    fail(f"{source['package']}: symbolic link skills root is not self-contained")
                    errors += 1
                    break
                if not (source_skill / "SKILL.md").is_file():
                    fail(f"{source['package']}: skills/{name}/SKILL.md not found at {source['ref']}")
                    errors += 1
                    continue
                target = destination / name
                try:
                    digests[name] = hash_skill_dir(source_skill)
                    if target.exists() or target.is_symlink():
                        hash_skill_dir(target)
                except RuntimeError as error:
                    fail(f"{source['package']}: {error}")
                    errors += 1
            prepared.append((source, destination, checkout, sha, digests))

        # 所有来源与旧目标均完成检查后才替换；无效的后续技能不能留下部分更新。
        if errors:
            return 1
        for source, destination, checkout, sha, digests in prepared:
            for name in source["skills"]:
                target = destination / name
                if target.exists():
                    shutil.rmtree(target)
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copytree(checkout / "skills" / name, target)
                if hash_skill_dir(target) != digests[name]:
                    raise RuntimeError(f"{source['package']}: copied skill digest differs from preflight")
            source["sha"] = sha
            source["sha256"] = digests
            print(f"{source['package']}: vendored {len(digests)} skills at {sha[:12]}")

    if errors:
        return 1
    validate_plugin_local_inventory(root, lock)
    lock_path.write_text(json.dumps(lock, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"lockfile updated: {lock_path}")
    return 0


def cmd_check(lock_path: Path, offline: bool, overrides: dict[str, str]) -> int:
    """Verify local digests and optionally the remote immutable source."""
    root = lock_path.parent
    lock = load_lock(lock_path)
    validate_no_cross_source_collisions(lock)
    validate_plugin_local_inventory(root, lock)
    errors = 0

    with tempfile.TemporaryDirectory(prefix="skill-vendor-") as temporary:
        for source in lock["sources"]:
            package = source["package"]
            destination = validate_source(source, root)
            locked = source.get("sha256", {})
            for name in source["skills"]:
                target = destination / name
                if not (target / "SKILL.md").is_file():
                    fail(f"{package}: managed skill skills/{name} is missing from the tree")
                    errors += 1
                    continue
                if hash_skill_dir(target) != locked.get(name):
                    fail(f"{package}: skills/{name} content differs from the lockfile digest")
                    errors += 1

            if offline:
                continue

            try:
                checkout, sha = source_checkout(source, overrides, Path(temporary))
            except (RuntimeError, subprocess.CalledProcessError) as error:
                fail(f"{package}: {error}")
                errors += 1
                continue
            if sha != source.get("sha"):
                fail(
                    f"{package}: {source['ref']} moved to {sha[:12]} "
                    f"(locked at {str(source.get('sha'))[:12]}); run update"
                )
                errors += 1
                continue
            for name in source["skills"]:
                upstream_skill = checkout / "skills" / name
                if not (upstream_skill / "SKILL.md").is_file():
                    fail(f"{package}: skills/{name} missing upstream")
                    errors += 1
                    continue
                if hash_skill_dir(upstream_skill) != locked.get(name):
                    fail(f"{package}: skills/{name} upstream content differs from the lockfile")
                    errors += 1

    if errors:
        return 1
    suffix = " (offline)" if offline else ""
    print(f"skill vendor check: all managed skills match the lockfile{suffix}")
    return 0


def parse_assignments(pairs: list[str], option: str) -> dict[str, str]:
    """Parse repeatable ``PACKAGE=VALUE`` assignments."""
    assignments = {}
    for pair in pairs:
        package, separator, value = pair.partition("=")
        if not separator or not package or not value:
            raise SystemExit(f"{option} expects PKG=VALUE, got '{pair}'")
        if package in assignments:
            raise SystemExit(f"{option} repeats package '{package}'")
        assignments[package] = value
    return assignments


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("update", "check"))
    parser.add_argument("--lock", default="skills.lock.json")
    parser.add_argument("--offline", action="store_true")
    parser.add_argument("--source-path", action="append", default=[], metavar="PKG=PATH")
    parser.add_argument("--source-ref", action="append", default=[], metavar="PKG=TAG")
    parser.add_argument("--expected-sha", action="append", default=[], metavar="PKG=SHA")
    args = parser.parse_args()

    lock_path = Path(args.lock).resolve()
    if not lock_path.is_file():
        fail(f"lockfile not found: {lock_path}")
        return 1
    try:
        if args.command == "update":
            return cmd_update(
                lock_path,
                parse_assignments(args.source_path, "--source-path"),
                parse_assignments(args.source_ref, "--source-ref"),
                parse_assignments(args.expected_sha, "--expected-sha"),
            )
        if args.source_ref or args.expected_sha:
            raise RuntimeError("--source-ref and --expected-sha are only valid with update")
        return cmd_check(
            lock_path,
            args.offline,
            parse_assignments(args.source_path, "--source-path"),
        )
    except (RuntimeError, subprocess.CalledProcessError, json.JSONDecodeError) as error:
        fail(str(error))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
