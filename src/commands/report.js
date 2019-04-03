const {Command, flags} = require('@oclif/command')

const sqlite3 = require('better-sqlite3')
const config = require('config')
const converter = require('json-2-csv')

class ReportCommand extends Command {
  report1(db) {
    const rows = db.prepare(`select tdays, count(issue_) as count
      from opsMeasure natural join issues i
      where i.issueResolutionStamp between '2019-03-28' and '2019-04-04'
      group by tdays order by tdays;`).all()
    converter.json2csvAsync(rows, {delimiter: {field: '\t'}})
    .then(r => {
      this.log(r)
    })
  }

  async run() {
    const {flags} = this.parse(ReportCommand)
    const id = flags.id || 0
    const database = flags.db || (config.has('database') ? config.get('database') : ':memory:')
    const db = sqlite3(database, {})

    switch (id) {
    case 'weekly':
    case '1':
      this.report1(db)
      break
    default:
      this.error(`report id not implemented : ${id}`)
    }
  }
}

ReportCommand.description = `Describe the command here
...
Extra documentation goes here
`

ReportCommand.flags = {
  db: flags.string({char: 'd', description: 'database to fill'}),
  id: flags.string({char: 'i', description: 'id of report to generate'}),
}

module.exports = ReportCommand
