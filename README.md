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
jerg/0.0.0 darwin-x64 node-v11.14.0
$ jerg --help [COMMAND]
USAGE
  $ jerg COMMAND
...
```
<!-- usagestop -->
# Commands
<!-- commands -->
* [`jerg help [COMMAND]`](#jerg-help-command)
* [`jerg issue`](#jerg-issue)
* [`jerg issues`](#jerg-issues)
* [`jerg metadata`](#jerg-metadata)
* [`jerg remove`](#jerg-remove)
* [`jerg report`](#jerg-report)

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

## `jerg issue`

Describe the command here

```
USAGE
  $ jerg issue

OPTIONS
  -n, --name=name  name to print

DESCRIPTION
  ...
  Extra documentation goes here
```

_See code: [src/commands/issue.js](https://github.com/the-reverend/jerg/blob/v0.0.0/src/commands/issue.js)_

## `jerg issues`

Fetch issues from Jira API

```
USAGE
  $ jerg issues

OPTIONS
  -d, --db=db              database to fill
  -p, --projects=projects  comma separated projects to query
  -z, --days=days          days to look back
```

_See code: [src/commands/issues.js](https://github.com/the-reverend/jerg/blob/v0.0.0/src/commands/issues.js)_

## `jerg metadata`

Fetch field data from Jira API

```
USAGE
  $ jerg metadata

OPTIONS
  -d, --db=db  database to fill
```

_See code: [src/commands/metadata.js](https://github.com/the-reverend/jerg/blob/v0.0.0/src/commands/metadata.js)_

## `jerg remove`

Remove issues from local db

```
USAGE
  $ jerg remove

OPTIONS
  -d, --db=db        database to update
  -i, --issue=issue  issue to remove from db
```

_See code: [src/commands/remove.js](https://github.com/the-reverend/jerg/blob/v0.0.0/src/commands/remove.js)_

## `jerg report`

Generate reports from local db

```
USAGE
  $ jerg report

OPTIONS
  -a, --a=a            start date
  -b, --b=b            end date
  -d, --db=db          database to query
  -f, --format=format  output formats: [csv, txt, tsv, mdt]
  -i, --id=id          id of report to generate
  -r, --showRange      show date range
  -v, --verbose        verbose output
```

_See code: [src/commands/report.js](https://github.com/the-reverend/jerg/blob/v0.0.0/src/commands/report.js)_
<!-- commandsstop -->
