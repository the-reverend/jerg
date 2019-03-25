const {Command, flags} = require('@oclif/command')

const request = require('request-promise')
const sqlite3 = require('better-sqlite3')
const config = require('config')
const _ = require('lodash')

const jiraConfig = config.has('jira') ? config.get('jira') : {}
const requestDefaults = {
  baseUrl: jiraConfig.base_url,
  auth: {
    user: jiraConfig.email,
    password: jiraConfig.api_token,
  },
  headers: {
    Accept: 'application/json',
  },
  qs: {},
  gzip: true,
  json: true,
}
const req = request.defaults(requestDefaults)

class IssuesCommand extends Command {
  async run() {
    const {flags} = this.parse(IssuesCommand)
    const database = flags.db || ':memory:'
    const db = sqlite3(database, {})
    this.log(`writing to database: ${database}`)
    req.get({uri: '/search', qs: {jql: 'key=EO-2059' /* and project=EO and statusCategory not in (done)' */, fields: '*all', expand: 'names,changelog', fieldsByKeys: true, maxResults: 1, startAt: 0}})
    .then(res => {
    /*
    { expand: 'names,schema',
      startAt: 1,
      maxResults: 1,
      total: 12,
      issues:
      [ { expand:
           'operations,customfield_11800.properties,customfield_12303.properties,versionedRepresentations,editmeta,changelog,renderedFields',
         id: '387585',
         self: 'https://underarmour.atlassian.net/rest/api/2/issue/387585',
         key: 'EO-2058',
         fields: [Object] } ] }
    */
      res.issues.forEach(function (i) {
        i.fields = _.chain(i.fields).omitBy(_.isNull).omitBy(_.isEmpty).omitBy((v, k) => {
          return k.startsWith('customfield')
        }).value()
        // we need to call /{issue key}/changelog (pagination) to get the full change log; we only get 5 records here...
        i.changelog.histories = i.changelog.histories.map(h => {
          // trim down the change log to just state transitions
          return {
            created: h.created,
            author: h.author.name,
            status: _.chain(h.items).filter(ii => {
              return ii.fieldId === 'status'
            }).first().value(),
            resolution: _.chain(h.items).filter(ii => {
              return ii.fieldId === 'resolution'
            }).first().value(),
          }
        }).filter(h => {
          return _.has(h, 'status') && !_.isUndefined(h.status)
        })
        console.log(JSON.stringify(i))
      })
    })
  }
}

IssuesCommand.description = `Describe the command here
...
Extra documentation goes here
`

IssuesCommand.flags = {
  db: flags.string({char: 'd', description: 'database to fill'}),
}

module.exports = IssuesCommand
