#!/bin/sh
# DEPRECATED — Xcode Cloud lit ci_scripts à côté de App.xcodeproj, pas à la racine.
# Scripts actifs : ios/App/ci_scripts/
set -e
cd "${CI_PRIMARY_REPOSITORY_PATH:-.}"
exec sh ios/App/ci_scripts/ci_post_clone.sh
