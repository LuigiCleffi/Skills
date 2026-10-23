#!/usr/bin/env bash
#
# Builds, checks, versions and publishes the package to npm.
#
# Usage:
#   npm run release                 # patch release (1.0.6 -> 1.0.7)
#   npm run release -- minor        # minor release (1.0.6 -> 1.1.0)
#   npm run release -- major        # major release (1.0.6 -> 2.0.0)
#   npm run release -- --dry-run    # run every check without publishing
#
# If the version in package.json is already on npm, it is bumped first;
# otherwise it is published as is.

set -euo pipefail

cd "$(dirname "$0")/.."

bump="patch"
dry_run=false

for argument in "$@"; do
  case "$argument" in
    patch | minor | major) bump="$argument" ;;
    --dry-run) dry_run=true ;;
    *)
      echo "Unknown argument: $argument" >&2
      echo "Usage: npm run release -- [patch|minor|major] [--dry-run]" >&2
      exit 1
      ;;
  esac
done

step() {
  echo
  echo "▶ $1"
}

fail() {
  echo "✖ $1" >&2
  exit 1
}

is_published() {
  [ -n "$(npm view "$package_name@$1" version 2>/dev/null)" ]
}

package_name=$(node -p "require('./package.json').name")
current_version=$(node -p "require('./package.json').version")

step "Checking npm login"
npm_user=$(npm whoami 2>/dev/null) || fail "Not logged in to npm. Run 'npm login' and try again."
echo "Logged in as $npm_user"

step "Choosing the version"
if is_published "$current_version"; then
  next_version=$(node -p "
    const [major, minor, patch] = '$current_version'.split('-')[0].split('.').map(Number);
    ({ major: [major + 1, 0, 0], minor: [major, minor + 1, 0], patch: [major, minor, patch + 1] })['$bump'].join('.');
  ")
  echo "$current_version is already published; releasing $bump version $next_version"
else
  next_version="$current_version"
  echo "$current_version is not published yet; releasing it as is"
fi

if is_published "$next_version"; then
  fail "$package_name@$next_version is already published. Choose a bigger bump."
fi

step "Installing dependencies"
npm ci --no-audit --no-fund

step "Building"
npm run build

step "Checking the package"
node -e "
  const bin = require('./package.json').bin;
  if (typeof bin !== 'object' || !bin['$package_name']) process.exit(1);
" || fail "package.json must declare bin as { \"$package_name\": \"dist/cli.js\" }."

pack_output=$(npm pack --dry-run 2>&1)
echo "$pack_output" | grep -E "total files|package size" || true

if echo "$pack_output" | grep -qi "npm warn"; then
  echo "$pack_output" | grep -i "npm warn" >&2
  fail "npm reported warnings while packing. Fix them (often with 'npm pkg fix') before publishing."
fi

for required_file in dist/cli.js templates/CleanCode/README.md; do
  echo "$pack_output" | grep -q "$required_file" || fail "The package is missing $required_file."
done

if [ "$dry_run" = true ]; then
  echo
  echo "✔ Dry run passed. $package_name@$next_version is ready to publish."
  echo "  Nothing was changed or published."
  exit 0
fi

if [ "$next_version" != "$current_version" ]; then
  step "Bumping version to $next_version"
  npm version "$next_version" --no-git-tag-version
fi

step "Publishing $package_name@$next_version"
# The build already ran above, so skip prepublishOnly.
npm publish --ignore-scripts

echo
echo "✔ Published $package_name@$next_version"
echo "  Commit the version change when ready, for example:"
echo "  git commit -am \"$next_version\" && git tag v$next_version"
