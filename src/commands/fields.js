const {Command, flags} = require('@oclif/command')

// process.env.NODE_CONFIG_DIR = '../../config'

// const _ = require('lodash')
const request = require('request-promise')
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
    const name = flags.name || 'world'
    this.log(`hello ${name} from /mnt/u/ronal/src/jerg/src/commands/fields.js`)
    req.get({uri: '/field'}).then(function (res) {
      console.log(JSON.stringify(res))
    })
  }
}

FieldsCommand.description = `Describe the command here
...
Extra documentation goes here
`

FieldsCommand.flags = {
  name: flags.string({char: 'n', description: 'name to print'}),
}

module.exports = FieldsCommand
