const {Command, flags} = require('@oclif/command')

const moment = require('moment')
const request = require('request-promise')
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

class IssueCommand extends Command {
  async run() {
    const {flags} = this.parse(IssueCommand)
    const issue = flags.issue

    let options = {
      uri: '/search',
      qs: {
        // also query for updated > -Nd so that the first run will get historical data and fill an empty database.
        // subsequent runs will use the updated date to fetch only new information.
        jql: `key = ${issue}`,
        fields: fieldList,
        expand: 'changelog',
        maxResults: 50,
        startAt: 0,
      },
    }
    // this.log(`jira query: ${options.qs.jql}`)
    return req.get(options)
    .then(res => {
      this.log(JSON.stringify(res))
    })
  }
}

IssueCommand.description = 'Get raw data from jira to help debug an issue import.'

IssueCommand.flags = {
  issue: flags.string({char: 'i', description: 'issue to look up'}),
}

module.exports = IssueCommand
