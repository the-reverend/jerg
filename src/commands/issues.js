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

class IssuesCommand extends Command {
  storeStatusLog(db, issues, insert, clean) {
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
        insert.run(h.id, moment(h.created).format('YYYY-MM-DDTHH:mm:ss.sssZ'), i.id, h.status.to)
      })

      if (i.changelog.maxResults === i.changelog.total) {
        if (log.length === 0) {
          // add a fake entry to indicate initial ticket status in the absence of historical transitions
          insert.run(0, moment(i.fields.created).format('YYYY-MM-DDTHH:mm:ss.sssZ'), i.id, i.fields.status.id)
        } else {
          const last = _.last(log)
          clean.run(i.id) // since we have historical data, we can discard the fake entry if it exists
          insert.run(last.id, moment(i.fields.created).format('YYYY-MM-DDTHH:mm:ss.sssZ'), i.id, last.status.from)
        }
      } else {
        this.log(`need to paginate history on ticket ${i.issueKey}`)
      }
    })
  }

  storeIssues(db, issues, insert) {
    issues.forEach(i => {
      insert.run(
        i.id,
        i.key,
        i.fields.summary,
        moment(i.fields.created).format('YYYY-MM-DDTHH:mm:ss.sssZ'),
        i.fields.lastViewed ? moment(i.fields.lastViewed).format('YYYY-MM-DDTHH:mm:ss.sssZ') : null,
        i.fields.resolutiondate ? moment(i.fields.resolutiondate).format('YYYY-MM-DDTHH:mm:ss.sssZ') : null,
        moment(i.fields.updated).format('YYYY-MM-DDTHH:mm:ss.sssZ'),
        i.fields.duedate ? moment(i.fields.duedate).format('YYYY-MM-DDTHH:mm:ss.sssZ') : null,
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

  fetchIssues(db, projects, dayRange) {
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
      and i.issueType not in ('Epic')
      and ifnull(strftime('%s',i.issueDueDate),0) < strftime('%s','now') -- exclude future tasks
      and i.issueLabels not like '%blocked%'
      and i.issueLabels not like '%awaiting%'
      and i.issueLabels not like '%exclude%'
      and (i.issueResolution not in ('Duplicate','Dev Only','No Response','Expired') or i.issueResolution is null)
      and ii.statusName not in ('Request Canceled')`).run()

    // get time stamp
    const rows = db.prepare('select issueUpdatedStamp from issues order by issueUpdatedStamp desc limit 1').all()
    const lastUpdated = moment(rows.length > 0 ? rows[0].issueUpdatedStamp : '2010-01-01T00:00:00.000Z')

    // insert statements
    const issueInsert = db.prepare('insert or replace into issues values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
    const logInsert = db.prepare('insert or replace into issueStatusLog values (?,?,?,?)')

    // delete statements
    const logClean = db.prepare('delete from issueStatusLog where issueStatusLog_ = 0 and issue_ = ?')

    // NOTE: there is a bug/limitation in JQL - you can only query by date greater than HH:MM so you will always
    //       get one ticket returned with this JQL query because your last updated ticket will have been modified
    //       a few seconds after the HH:MM you're querying for, because the seconds get truncated. we're going to
    //       filter the result set later to make up for this limitation.
    let options = {
      uri: '/search',
      qs: {
        // also query for updated > -Nd so that the first run will get historical data and fill an empty database.
        // subsequent runs will use the updated date to fetch only new information.
        jql: `project in (${projects.join(',')}) and updated > -${dayRange}d and updated > '${lastUpdated.format('YYYY/MM/DD HH:mm')}'`,
        fields: fieldList,
        expand: 'changelog',
        maxResults: 50,
        startAt: 0,
      },
    }
    this.log(`jira query: ${options.qs.jql}`)
    return req.get(options)
    .then(res => {
      const last = res.total
      const inc = res.maxResults
      const start = res.issues.length
      let a = [res]
      for (let i = start; i < last; i += inc) {
        a.push(req(_.merge(options, {qs: {startAt: i, maxResults: inc}})))
      }
      return Promise.all(a)
    })
    .then(all => {
      all.forEach(res => {
        const issues = res.issues.filter(i => {
          // filter out tickets that match the last updated date to make up for jql limitation
          return moment(moment(i.fields.updated).format('YYYY-MM-DDTHH:mm:ss')) > moment(lastUpdated.format('YYYY-MM-DDTHH:mm:ss'))
        })
        var list = issues.reduce((a, v) => {
          a.push(v.key)
          return a
        }, [])
        if (list.length > 0) {
          this.log(`updating : ${list.join(', ')}`)
        }
        this.storeIssues(db, issues, issueInsert)
        this.storeStatusLog(db, issues, logInsert, logClean)
        this.log(`issues updated: ${issues.length}`)
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

  async run() {
    const {flags} = this.parse(IssuesCommand)
    const database = flags.db || (config.has('database') ? config.get('database') : ':memory:')
    const projects = (flags.projects && flags.projects.split(',')) || (config.has('projects') ? config.get('projects') : ['EO'])
    const dayRange = parseInt(flags.days, 10) || (config.has('dayRange') ? config.get('dayRange') : 35)
    const db = sqlite3(database, {})
    this.log(`writing to database: ${database}`)

    this.fetchIssues(db, projects, dayRange)
  }
}

IssuesCommand.description = 'Fetch issues from Jira API'

IssuesCommand.flags = {
  db: flags.string({char: 'd', description: 'database to fill'}),
  projects: flags.string({char: 'p', description: 'comma separated projects to query'}),
  days: flags.string({char: 'z', description: 'days to look back'}),
}

module.exports = IssuesCommand
