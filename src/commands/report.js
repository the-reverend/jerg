const {Command, flags} = require('@oclif/command')

const sqlite3 = require('better-sqlite3')
const config = require('config')
const converter = require('json-2-csv')
const moment = require('moment')
const _ = require('lodash')

class ReportCommand extends Command {
  parseDateKeywords(d) {
    switch (d) {
    case 'now': return moment()
    case 'today': return moment().startOf('day')
    case 'eod': return moment().endOf('day')
    }
    const formats = [
      'YYYY-MM-DD',
      'YYYY/MM/DD',
      'MM/DD/YYYY',
      'MM-DD/YYYY',
    ]
    const i = parseInt(d, 10)
    if (_.isInteger(i) && i.toString() === d) {
      return moment().startOf('day').add(i, 'd')
    }
    const m = moment(d, formats)
    if (m.isValid()) {
      return m
    }
    this.error(`argument is not a date: ${d}`)
    return moment('2010-01-01')
  }

  report1(db, a, b) {
    const rows = db.prepare(`select tdays, count(issue_) as count
      from opsMeasure natural join issues i
      where i.issueResolutionStamp between ? and ?
      group by tdays order by tdays;`).all([
        a.format('YYYY-MM-DD HH:mm:ss'),
        b.format('YYYY-MM-DD HH:mm:ss')]
      )
    converter.json2csvAsync(rows, {delimiter: {field: '\t'}})
    .then(r => {
      this.log(r)
    })
  }

  async run() {
    const {flags} = this.parse(ReportCommand)
    const id = flags.id || 0
    const database = flags.db || (config.has('database') ? config.get('database') : ':memory:')
    const a = this.parseDateKeywords(flags.a || '-7')
    const b = this.parseDateKeywords(flags.b || 'eod')
    const db = sqlite3(database, {})

    switch (id) {
    case 'weekly':
    case '1':
      this.report1(db, a, b)
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
  a: flags.string({char: 'a', description: 'start date'}),
  b: flags.string({char: 'b', description: 'end date'}),
}

module.exports = ReportCommand
