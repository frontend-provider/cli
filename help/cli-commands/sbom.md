# SBOM

## Prerequisites

**Feature availability:** This feature is available to customers on Snyk Enterprise plans.

**Note:** In order to run the SBOM generation feature, you must use a minimum of CLI version 1.1071.0.

The `snyk sbom` feature requires an internet connection.

## Usage

`$ snyk sbom --format=<cyclonedx1.4+json|cyclonedx1.4+xml>|spdx2.3+json> [--file=<file>] [--unmanaged] [--org=<ORG_ID>] [<TARGET_DIRECTORY>]`

## Description

The `snyk sbom` command generates an SBOM for a local software project in an ecosystem supported by Snyk.

Supported formats include CycloneDX v1.4 (JSON or XML) and SPDX v2.3 (JSON).

An SBOM can be generated for all supported Open Source package managers as well as unmanaged software projects.

## Exit codes

Possible exit codes and their meaning:

**0**: success (process completed), SBOM created successfully\
**2**: failure, try to re-run command

## Debug

Use the `-d` option to output the debug logs.

## Options

### `--format=<cyclonedx1.4+json|cyclonedx1.4+xml|spdx2.3+json>`

Required. Specify the output format for the SBOM to be produced.

Set the desired SBOM output format. Available options are `cyclonedx1.4+json`, `cyclonedx1.4+xml`, and `spdx2.3+json`

### `[--org=<ORG_ID>]`

Specify the `<ORG_ID>` (name or UUID) to run Snyk commands tied to a specific organization. The `<ORG_ID>` influences some features availability and private test limits.

Use this option when your default organization does not have API entitlement.

If this option is omitted, the default organization for your account will be used.

This is the `<ORG_ID>` that is the current preferred organization in your [Account settings](https://app.snyk.io/account)&#x20;

Set a default to ensure all newly tested projects are tested under your default organization. If you need to override the default, use the `--org=<ORG_ID>` option.

If you have multiple organizations, you can set a default from the CLI using:

`$ snyk config set org=<ORG_ID>`

**Note:** You can also use `--org=<orgslugname>.` The `ORG_ID` works in both the CLI and the API. The organization slug name works in the CLI, but not in the API.

For more information see the article [How to select the organization to use in the CLI](https://support.snyk.io/hc/en-us/articles/360000920738-How-to-select-the-organization-to-use-in-the-CLI)

### `[--file=<file>] or [--f=<file>]`

Specify the desired manifest file on which the SBOM will be based.&#x20;

By default, the `sbom` command detects a supported manifest file in the current working directory.

### `[--unmanaged]`

Generate an SBOM for unmanaged software projects.

### `[<TARGET_DIRECTORY>]`

Optional. Instruct the CLI to autodetect a package manager manifest file to use within the specified directory. If `--file` is set, this option will be ignored.

**Note:** Support for the `--all-projects` option is planned for later versions.

## Examples for the snyk sbom command

### Create a CycloneDX JSON document for a local software project

`$ snyk sbom --format=cyclonedx1.4+json`

### Create a CycloneDX JSON document and write it to a local file

`$ snyk sbom --format=cyclonedx1.4+json > mySBOM.json`

### Create an SPDX 2.3 JSON document for an unmanaged software project

`$ snyk sbom --unmanaged --format=spdx2.3+json`

### Create a CycloneDX XML document for a Maven project

`$ snyk sbom --file=pom.xml --format=cyclonedx1.4+xml`
