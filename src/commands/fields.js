const {Command, flags} = require('@oclif/command')

const request = require('request-promise')
const sqlite3 = require('better-sqlite3')
const config = require('config')

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

class FieldsCommand extends Command {
  async run() {
    const {flags} = this.parse(FieldsCommand)
    const database = flags.db || ':memory:'
    const db = sqlite3(database, {})
    this.log(`writing to database: ${database}`)
    /*
      {
        "id": "customfield_13349",
        "key": "customfield_13349",
        "name": "Region Paid Media Details",
        "custom": true,
        "orderable": true,
        "navigable": true,
        "searchable": true,
        "clauseNames": [
          "cf[13349]",
          "Region Paid Media Details"
        ],
        "schema": {
          "type": "string",
          "custom": "com.atlassian.jira.plugin.system.customfieldtypes:textarea",
          "customId": 13349
        }
      }
    */
    db.prepare('create table if not exists fields (\'field-id\' text, key text, name text);').run()
    db.prepare('create unique index if not exists \'fields-k1\' on fields (\'field-id\');').run()
    const insert = db.prepare('insert or replace into fields values (?,?,?)')
    req.get({uri: '/field'}).then(function (res) {
      res.forEach(function (f) {
        insert.run(f.id, f.key, f.name)
      })
    })
  }
}

FieldsCommand.description = `Fetch field data from Jira API
...
Extra documentation goes here
`

FieldsCommand.flags = {
  db: flags.string({char: 'd', description: 'database to fill'}),
}

module.exports = FieldsCommand
