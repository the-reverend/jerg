const {Command, flags} = require('@oclif/command')

const moment = require('moment')
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
const fieldList = [
  'assignee',
  'created',
  'creator',
  'customfield_10002', // Story Points
  'customfield_13306', // Dev Team
  'duedate',
  'issuetype',
  'lastViewed',
  'priority',
  'project',
  'reporter',
  'resolution',
  'resolutiondate',
  'status',
  'summary',
  'updated',
  // 'aggregatetimespent',
  // 'comment',
  // 'description',
  // 'issuelinks',
  // 'progress',
  // 'timespent',
  // 'timetracking',
  // 'worklog',
  // '*all',
].join()

function storeIssues(db, issues, insert) {
  issues.forEach(i => {
    insert.run(
      i.id,
      i.key,
      i.fields.summary,
      i.fields.created, // moment?
      i.fields.lastViewed, // moment
      i.fields.resolutiondate ? i.fields.resolutiondate : null,
      i.fields.updated, // moment
      i.fields.duedate ? i.fields.duedate : null,
      /*
        "assignee": {
          "self": "https://underarmour.atlassian.net/rest/api/2/user?accountId=557058%3A6d081afa-0704-4787-89d2-453fc28b5ead",
          "name": "rwilson",
          "key": "rwilson",
          "accountId": "557058:6d081afa-0704-4787-89d2-453fc28b5ead",
          "emailAddress": "rwilson1@underarmour.com",
          "avatarUrls": { ... snip ... },
          "displayName": "Ronald Wilson",
          "active": true,
          "timeZone": "America/New_York"
        },
      */
      i.fields.assignee ? i.fields.assignee.key : null,
      i.fields.creator ? i.fields.creator.key : null,
      i.fields.reporter ? i.fields.reporter.key : null,
      i.fields.status.id,
      i.fields.customfield_10002, // Story Points
      /*
        "issuetype": {
          "self": "https://underarmour.atlassian.net/rest/api/2/issuetype/10200",
          "id": "10200",
          "description": "A problem which impairs or prevents the functions of the product.",
          "iconUrl": "https://underarmour.atlassian.net/secure/viewavatar?size=xsmall&avatarId=24005&avatarType=issuetype",
          "name": "Bug",
          "subtask": false,
          "avatarId": 24005
        },
      */
      i.fields.issuetype.name,
      /*
        "priority": {
          "self": "https://underarmour.atlassian.net/rest/api/2/priority/4",
          "iconUrl": "https://underarmour.atlassian.net/images/icons/priorities/major.svg",
          "name": "High",
          "id": "4"
        },
      */
      i.fields.priority.name,
      /*
        "project": {
          "self": "https://underarmour.atlassian.net/rest/api/2/project/21900",
          "id": "21900",
          "key": "CE",
          "name": "Continuous Engineering",
          "projectTypeKey": "software",
          "avatarUrls": { ... snip ... },
          "projectCategory": {
            "self": "https://underarmour.atlassian.net/rest/api/2/projectCategory/10102",
            "id": "10102",
            "description": "Projects used to support various ecomm groups for daily activities.",
            "name": "Ecommerce Workflows"
          }
        },
      */
      i.fields.project.key,
      /*
        "resolution": {
          "self": "https://underarmour.atlassian.net/rest/api/2/resolution/1",
          "id": "1",
          "description": "",
          "name": "Done"
        },
      */
      i.fields.resolution ? i.fields.resolution.name : null,
      i.fields.customfield_13306 ? i.fields.customfield_13306.value : null // Dev Team
    )
  })
}

function fetchIssues(db) {
  /*
  { expand: 'names,schema',
    startAt: 0,
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
  db.prepare(['create table if not exists issues (issue_ integer',
    'issueKey text',
    'issueSummary text',
    'issueCreatedStamp text',
    'issueLastViewedStamp text',
    'issueResolutionStamp text',
    'issueUpdatedStamp text',
    'issueDueDate date',
    'issueAssignee_ integer',
    'issueCreator_ integer',
    'issueReporter_ integer',
    'issueStatus_ integer',
    'issueStoryPoints integer',
    'issueType text',
    'issuePriority integer',
    'issueProject text',
    'issueResolution text',
    'issueDevTeam text);'].join(', ')).run()
  const rows = db.prepare('select issueUpdatedStamp from issues order by issueUpdatedStamp desc limit 1').all()
  const lastUpdated = moment(rows.length > 0 ? rows[0].issueLastUpdatedStamp : '1970-01-01T00:00:00.000Z').format('YYYY-MM-DD HH:mm')
  console.log(`lastUpdated : ${lastUpdated}`)
  db.prepare('create unique index if not exists issues1 on issues (issue_);').run()
  const insert = db.prepare('insert or replace into issues values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
  let options = {
    uri: '/search',
    qs: {
      jql: `project=EO and updated > -30d and updated > '${lastUpdated}'`,
      fields: fieldList,
      expand: 'changelog',
      // fieldsByKeys: true, // doesn't appear to do anything
      maxResults: 50,
      startAt: 0,
    },
  }
  return req.get(options)
  .then(res => {
    console.log(`issues updated: ${res.issues.length}`)
    storeIssues(db, res.issues, insert)
    const last = res.total
    const inc = res.maxResults
    const start = res.issues.length
    let a = []
    for (let i = start; i < last; i += inc) {
      a.push(req(_.merge(options, {qs: {startAt: i, maxResults: inc}})))
    }
    return Promise.all(a)
  })
  .then(all => {
    all.forEach(res => {
      console.log(res.issues.length)
      storeIssues(db, res.issues, insert)
    })
  })

  /*
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
    })
  */
}

class IssuesCommand extends Command {
  async run() {
    const {flags} = this.parse(IssuesCommand)
    const database = flags.db || ':memory:'
    const db = sqlite3(database, {})
    this.log(`writing to database: ${database}`)

    fetchIssues(db)
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
