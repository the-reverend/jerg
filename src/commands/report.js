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
      return moment().startOf('day').add(i + 1, 'd')
    }
    const m = moment(d, formats)
    if (m.isValid()) {
      return m
    }
    this.error(`argument is not a date: ${d}`)
    return moment('2010-01-01')
  }

  report2(db, a, b) {
    const stats = {
      inherited: {
        unresolved: db.prepare(`select count(1) val
          from opsMeasure o
          join issues i on i.issue_ = o.issue_
          where i.issueCreatedStamp < ?
          and (
            i.issueResolutionStamp > ?
            or i.issueResolutionStamp is null
          )`)
        .all([
          a.format('YYYY-MM-DDTHH:mm:ss'),
          b.format('YYYY-MM-DDTHH:mm:ss'),
        ])[0].val,

        resolved: db.prepare(`select count(1) val
          from opsMeasure o
          join issues i on i.issue_ = o.issue_
          where i.issueCreatedStamp < ?
          and i.issueResolutionStamp between ? and ?`)
        .all([
          a.format('YYYY-MM-DDTHH:mm:ss'),
          a.format('YYYY-MM-DDTHH:mm:ss'),
          b.format('YYYY-MM-DDTHH:mm:ss'),
        ])[0].val,
      },
      created: {
        unresolved: db.prepare(`select count(1) val
          from opsMeasure o
          join issues i on i.issue_ = o.issue_
          where i.issueCreatedStamp between ? and ?
          and (
            i.issueResolutionStamp > ?
            or i.issueResolutionStamp is null
          )`)
        .all([
          a.format('YYYY-MM-DDTHH:mm:ss'),
          b.format('YYYY-MM-DDTHH:mm:ss'),
          b.format('YYYY-MM-DDTHH:mm:ss'),
        ])[0].val,

        resolved: db.prepare(`select count(1) val
          from opsMeasure o
          join issues i on i.issue_ = o.issue_
          where i.issueCreatedStamp between ? and ?
          and i.issueResolutionStamp between ? and ?`)
        .all([
          a.format('YYYY-MM-DDTHH:mm:ss'),
          b.format('YYYY-MM-DDTHH:mm:ss'),
          a.format('YYYY-MM-DDTHH:mm:ss'),
          b.format('YYYY-MM-DDTHH:mm:ss'),
        ])[0].val,
      },
      totals: {
        unresolved: db.prepare(`select count(1) val
          from opsMeasure o
          join issues i on i.issue_ = o.issue_
          where i.issueCreatedStamp < ?
          and (
            i.issueResolutionStamp > ?
            or i.issueResolutionStamp is null
          )`)
        .all([
          b.format('YYYY-MM-DDTHH:mm:ss'),
          b.format('YYYY-MM-DDTHH:mm:ss'),
        ])[0].val,

        resolved: db.prepare(`select count(o.issue_) val
          from opsMeasure o
          join issues i on i.issue_ = o.issue_
          where i.issueResolutionStamp between ? and ?`)
        .all([
          a.format('YYYY-MM-DDTHH:mm:ss'),
          b.format('YYYY-MM-DDTHH:mm:ss'),
        ])[0].val,
      },
    }
    this.log(stats)
  }

  report1(db, a, b) {
    const rows = db.prepare(`select tdays, count(o.issue_) as count
      from opsMeasure o natural join issues i
      where i.issueResolutionStamp between ? and ?
      and o.statusCategoryKey in ('done')
      group by tdays order by tdays`)
    .all([
      a.format('YYYY-MM-DDTHH:mm:ss'),
      b.format('YYYY-MM-DDTHH:mm:ss'),
    ])
    const total = rows.reduce((a, v) => {
      return a + v.count
    }, 0)
    converter.json2csvAsync(rows.map((r, i, a) => {
      if (i === 0) {
        r.sum = r.count
      } else {
        r.sum = r.count + a[i - 1].sum
      }
      r.percent = Math.round(10000.0 * r.count / total, 2) / 100.0
      r.cpercent = Math.round(10000.0 * r.sum / total, 2) / 100.0
      return r
    }), {delimiter: {field: '\t'}})
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

    if (flags.verbose) {
      this.log(`from : ${a.format('YYYY-MM-DD HH:mm:ss')}`)
      this.log(`to   : ${b.format('YYYY-MM-DD HH:mm:ss')}`)
    }

    switch (id) {
    case 'sla':
    case '1':
      this.report1(db, a, b)
      break
    case 'summary':
    case '2':
      this.report2(db, a, b)
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
  verbose: flags.boolean({char: 'v', description: 'verbose output'}),
}

module.exports = ReportCommand
