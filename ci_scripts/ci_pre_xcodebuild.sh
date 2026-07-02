#!/bin/sh
# DEPRECATED — voir ios/App/ci_scripts/
set -e
cd "${CI_PRIMARY_REPOSITORY_PATH:-.}"
exec sh ios/App/ci_scripts/ci_pre_xcodebuild.sh
