# jerg

jira report generator / aggregator

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Codecov](https://codecov.io/gh/the-reverend/jerg/branch/master/graph/badge.svg)](https://codecov.io/gh/the-reverend/jerg)
[![License](https://img.shields.io/github/license/the-reverend/jerg.svg)](https://github.com/the-reverend/jerg/blob/master/package.json)
<!--[![Version](https://img.shields.io/npm/v/jerg.svg)](https://npmjs.org/package/jerg)-->
<!--[![Downloads/week](https://img.shields.io/npm/dw/jerg.svg)](https://npmjs.org/package/jerg)-->

<!-- toc -->
* [jerg](#jerg)
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->
# Usage
<!-- usage -->
```sh-session
$ npm install -g jerg
$ jerg COMMAND
running command...
$ jerg (-v|--version|version)
jerg/0.0.0 darwin-x64 node-v11.11.0
$ jerg --help [COMMAND]
USAGE
  $ jerg COMMAND
...
```
<!-- usagestop -->
# Commands
<!-- commands -->
* [`jerg hello`](#jerg-hello)
* [`jerg help [COMMAND]`](#jerg-help-command)
* [`jerg issues`](#jerg-issues)
* [`jerg metadata`](#jerg-metadata)
* [`jerg report`](#jerg-report)

## `jerg hello`

Describe the command here

```
USAGE
  $ jerg hello

OPTIONS
  -n, --name=name  name to print

DESCRIPTION
  ...
  Extra documentation goes here
```

_See code: [src/commands/hello.js](https://github.com/the-reverend/jerg/blob/v0.0.0/src/commands/hello.js)_

## `jerg help [COMMAND]`

display help for jerg

```
USAGE
  $ jerg help [COMMAND]

ARGUMENTS
  COMMAND  command to show help for

OPTIONS
  --all  see all commands in CLI
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v2.1.6/src/commands/help.ts)_

## `jerg issues`

Describe the command here

```
USAGE
  $ jerg issues

OPTIONS
  -d, --db=db              database to fill
  -p, --projects=projects  comma separated projects to query
  -z, --days=days          days to look back

DESCRIPTION
  ...
  Extra documentation goes here
```

_See code: [src/commands/issues.js](https://github.com/the-reverend/jerg/blob/v0.0.0/src/commands/issues.js)_

## `jerg metadata`

Fetch field data from Jira API

```
USAGE
  $ jerg metadata

OPTIONS
  -d, --db=db  database to fill

DESCRIPTION
  ...
  Extra documentation goes here
```

_See code: [src/commands/metadata.js](https://github.com/the-reverend/jerg/blob/v0.0.0/src/commands/metadata.js)_

## `jerg report`

Describe the command here

```
USAGE
  $ jerg report

OPTIONS
  -d, --db=db  database to fill
  -i, --id=id  id of report to generate

DESCRIPTION
  ...
  Extra documentation goes here
```

_See code: [src/commands/report.js](https://github.com/the-reverend/jerg/blob/v0.0.0/src/commands/report.js)_
<!-- commandsstop -->
