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
  'labels',
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

function storeStatusLog(db, issues, insert, clean) {
  issues.forEach(i => {
    const log = i.changelog.histories.map(h => {
      // trim down the change log to just state transitions
      return {
        id: h.id,
        created: h.created,
        status: _.chain(h.items).filter(ii => {
          return ii.fieldId === 'status'
        }).first().value(),
      }
    }).filter(h => {
      return _.has(h, 'status') && !_.isUndefined(h.status)
    })

    log.forEach(h => {
      insert.run(h.id, moment(h.created).format("YYYY-MM-DDTHH:mm:ss.sssZ"), i.id, h.status.to)
    })

    if (i.changelog.maxResults === i.changelog.total) {
      if (log.length === 0) {
        // add a fake entry to indicate initial ticket status in the absence of historical transitions
        insert.run(0, moment(i.fields.created).format("YYYY-MM-DDTHH:mm:ss.sssZ"), i.id, i.fields.status.id)
      } else {
        const last = _.last(log)
        clean.run(i.id) // since we have historical data, we can discard the fake entry if it exists
        insert.run(last.id, moment(i.fields.created).format("YYYY-MM-DDTHH:mm:ss.sssZ"), i.id, last.status.from)
      }
    } else {
      console.log(`need to paginate history on ticket ${i.issueKey}`)
    }
  })
}

function storeIssues(db, issues, insert) {
  issues.forEach(i => {
    insert.run(
      i.id,
      i.key,
      i.fields.summary,
      moment(i.fields.created).format("YYYY-MM-DDTHH:mm:ss.sssZ"),
      i.fields.lastViewed ? moment(i.fields.lastViewed).format("YYYY-MM-DDTHH:mm:ss.sssZ") : null,
      i.fields.resolutiondate ? moment(i.fields.resolutiondate).format("YYYY-MM-DDTHH:mm:ss.sssZ") : null,
      moment(i.fields.updated).format("YYYY-MM-DDTHH:mm:ss.sssZ"),
      i.fields.duedate ? moment(i.fields.duedate).format("YYYY-MM-DDTHH:mm:ss.sssZ") : null,
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
      i.fields.labels.join(),
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
  // tables and indexes
  db.prepare(['create table if not exists issues (issue_ integer',
    'issueKey text',
    'issueSummary text',
    'issueCreatedStamp text',
    'issueLastViewedStamp text',
    'issueResolutionStamp text',
    'issueUpdatedStamp text',
    'issueDueDate date',
    'issueAssignee text',
    'issueCreator text',
    'issueReporter text',
    'issueLabels text',
    'issueStatus_ integer',
    'issueStoryPoints integer',
    'issueType text',
    'issuePriority integer',
    'issueProject text',
    'issueResolution text',
    'issueDevTeam text);'].join(', ')).run()
  db.prepare('create unique index if not exists issues1 on issues (issue_);').run()
  db.prepare('create index if not exists issues2 on issues (issueUpdatedStamp);').run()
  db.prepare('create table if not exists issueStatusLog (issueStatusLog_ integer, issueStatusStamp text, issue_ integer, status_ integer);').run()
  db.prepare('create unique index if not exists issueStatusLog1 on issueStatusLog (issueStatusLog_, issue_, status_);').run()

  // views
  db.prepare(`create view if not exists issueStatus as
    select a.*
    from issueStatusLog a
    left outer join issueStatusLog b
    on a.issue_ = b.issue_ and a.issueStatusStamp < b.issueStatusStamp
    where b.issue_ is NULL;`).run()
  db.prepare(`create view if not exists issueStatusLog2 as
    select *, strftime('%s',issueStatusStamp) as a
    , ifnull(group_concat(strftime('%s',issueStatusStamp),',') over (
        partition by issue_
        order by strftime('%s',issueStatusStamp) asc
      rows between 1 following and 1 following
      ), strftime('%s','now')) as b
    from issueStatusLog
    order by issue_, issueStatusStamp asc`).run()
  db.prepare(`create view if not exists issueStatusTiming as
    select issue_, sc.statusCategory_
    , strftime('%s',ifnull(i.issueDueDate,'1970-01-01')) d
    , statusCategoryKey, sum(b-max(a,strftime('%s',ifnull(i.issueDueDate,'1970-01-01')))) elapsed
    , (sum(b-max(a,strftime('%s',ifnull(i.issueDueDate,'1970-01-01'))))/86400) || ':' || time(sum(b-max(a,strftime('%s',ifnull(i.issueDueDate,'1970-01-01')))),'unixepoch') as dhms
    , (b-max(a,strftime('%s',ifnull(i.issueDueDate,'1970-01-01'))))/86400 - (strftime('%w',max(a,strftime('%s',ifnull(i.issueDueDate,'1970-01-01'))),'unixepoch','localtime') + (b-max(a,strftime('%s',ifnull(i.issueDueDate,'1970-01-01'))))/86400) / 7 * 2 elapsedWeekdays
    from issueStatusLog2 log
    natural join issues i
    natural join statuses s
    natural join statusCategories sc
    group by issue_, statusCategory_`).run()
  db.prepare(`create view if not exists opsMeasure as
    select i.issue_, i.issueKey, i.issueResolution
    , a.elapsed as new, a.dhms as newdhms, cast(a.elapsedWeekdays as integer) as ndays
    , b.elapsed as fix, b.dhms as fixdhms, cast(b.elapsedWeekdays as integer) as fdays
    , cast(ifnull(a.elapsedWeekdays,0) + ifnull(b.elapsedWeekdays, 0) as integer) as tdays
    , date(i.issueDueDate) as dueDate, ii.statusName, sc.statusCategoryKey, i.issueLabels
    from issues i
    join statuses ii on ii.status_ = i.issueStatus_
    join statusCategories sc on ii.statusCategory_ = sc.statusCategory_
    left join issueStatusTiming a on a.issue_ = i.issue_ and a.statusCategory_ = 2
    left join issueStatusTiming b on b.issue_ = i.issue_ and b.statusCategory_ = 4
    where 1=1
    and ifnull(strftime('%s',i.issueDueDate),0) < strftime('%s','now') -- exclude future tasks
    and i.issueLabels not like '%blocked%'
    and i.issueLabels not like '%awaiting%'
    and i.issueResolution not in ('Duplicate','Dev Only','No Response','Expired')
    and ii.statusName not in ('Request Canceled')
    and sc.statusCategoryKey in ('done')`).run()
  db.prepare(`create view if not exists opsHistogram as
    select tdays, count(issue_) as count, round(count(issue_)*100.0 / (select count(1) from histogram), 1) as percent
    from histogram
    group by tdays
    order by tdays`).run()

  // get time stamp
  const rows = db.prepare('select issueUpdatedStamp from issues order by issueUpdatedStamp desc limit 1').all()
  const lastUpdated = moment(rows.length > 0 ? rows[0].issueUpdatedStamp : '2010-01-01T00:00:00.000Z').format('YYYY/MM/DD HH:mm')
  console.log(`lastUpdated : ${lastUpdated}`)

  // insert statements
  const issueInsert = db.prepare('insert or replace into issues values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
  const logInsert = db.prepare('insert or replace into issueStatusLog values (?,?,?,?)')

  // delete statements
  const logClean = db.prepare('delete from issueStatusLog where issueStatusLog_ = 0 and issue_ = ?')

  // NOTE: there is a bug/limitation in JQL - you can only query by date greater than HH:MM so you will always
  //       get one ticket returned with this JQL query because your last updated ticket will have been modified
  //       a few seconds after the HH:MM you're querying for, because the seconds get truncated. the only work-
  //       around is to add a minute to your search JQL, but you risk missing an update, so the lesser evil is
  //       to just process the single ticket anyway.
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
  console.log(options.qs.jql)
  return req.get(options)
  .then(res => {
    console.log(`issues updated: ${res.issues.length}`)
    // console.log(JSON.stringify(res))
    storeIssues(db, res.issues, issueInsert)
    storeStatusLog(db, res.issues, logInsert, logClean)
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
      console.log(`issues updated: ${res.issues.length}`)
      storeIssues(db, res.issues, issueInsert)
      storeStatusLog(db, res.issues, logInsert, logClean)
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
