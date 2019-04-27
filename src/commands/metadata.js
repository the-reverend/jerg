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

class MetadataCommand extends Command {
  fetchFields(db) {
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
    db.prepare('create table if not exists fields (field_ text, fieldKey text, fieldName text);').run()
    db.prepare('create unique index if not exists fields1 on fields (field_);').run()
    const insert = db.prepare('insert or replace into fields values (?,?,?)')
    return req.get({uri: '/field'}).then(function (res) {
      res.forEach(function (f) {
        insert.run(f.id, f.key, f.name)
      })
    })
  }

  fetchStatusCategories(db) {
    /*
      [ { self:
           'https://underarmour.atlassian.net/rest/api/2/statuscategory/1',
          id: 1,
          key: 'undefined',
          colorName: 'medium-gray',
          name: 'No Category' },
        { self:
           'https://underarmour.atlassian.net/rest/api/2/statuscategory/2',
          id: 2,
          key: 'new',
          colorName: 'blue-gray',
          name: 'To Do' },
        { self:
           'https://underarmour.atlassian.net/rest/api/2/statuscategory/4',
          id: 4,
          key: 'indeterminate',
          colorName: 'yellow',
          name: 'In Progress' },
        { self:
           'https://underarmour.atlassian.net/rest/api/2/statuscategory/3',
          id: 3,
          key: 'done',
          colorName: 'green',
          name: 'Done' } ]
    */
    db.prepare('create table if not exists statusCategories (statusCategory_ integer, statusCategoryKey text, statusCategoryName text);').run()
    db.prepare('create unique index if not exists statusCategories1 on statusCategories (statusCategory_);').run()
    const insert = db.prepare('insert or replace into statusCategories values (?,?,?)')
    return req.get({uri: '/statuscategory'}).then(function (res) {
      res.forEach(function (sc) {
        insert.run(sc.id, sc.key, sc.name)
      })
    })
  }

  fetchStatuses(db) {
    /*
      { self: 'https://underarmour.atlassian.net/rest/api/2/status/11569',
        description: '',
        iconUrl:
         'https://underarmour.atlassian.net/images/icons/statuses/generic.png',
        name: 'In Go Live Prep',
        id: '11569',
        statusCategory:
         { self:
            'https://underarmour.atlassian.net/rest/api/2/statuscategory/4',
           id: 4,
           key: 'indeterminate',
           colorName: 'yellow',
           name: 'In Progress' } },
    */
    db.prepare('create table if not exists statuses (status_ integer, statusName text, statusDescription text, statusCategory_ integer);').run()
    db.prepare('create unique index if not exists statuses1 on statuses (status_);').run()
    const insert = db.prepare('insert or replace into statuses values (?,?,?,?)')
    return req.get({uri: '/status'}).then(function (res) {
      res.forEach(function (s) {
        insert.run(s.id, s.name, s.description, s.statusCategory.id)
      })
    })
  }

  async run() {
    const {flags} = this.parse(MetadataCommand)
    const database = flags.db || (config.has('database') ? config.get('database') : ':memory:')
    const db = sqlite3(database, {})
    this.log(`writing to database: ${database}`)

    this.fetchStatusCategories(db)
    .then(() => {
      return this.fetchStatuses(db)
    })
    .then(() => {
      return this.fetchFields(db)
    })
  }
}

MetadataCommand.description = 'Fetch field data from Jira API'

MetadataCommand.flags = {
  db: flags.string({char: 'd', description: 'database to fill'}),
}

module.exports = MetadataCommand
