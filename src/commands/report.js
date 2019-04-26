const {Command, flags} = require('@oclif/command')

const sqlite3 = require('better-sqlite3')
const config = require('config')
const csvRenderer = require('json-2-csv')
const moment = require('moment')
const tableRenderer = require('console.table')
const markdownRenderer = require('markdown-table')
const _ = require('lodash')

class ReportCommand extends Command {
  parseDateKeywords(d) {
    switch (d) {
    case 'now': return moment()
    case 'today': return moment().startOf('day')
    case 'eod': return moment().startOf('day').add(1, 'd')
    }
    const formats = [
      'YYYY-MM-DD',
      'YYYY/MM/DD',
      'MM/DD/YYYY',
      'MM-DD/YYYY',
    ]
    const i = _.toNumber(d)
    if (_.isInteger(i)) {
      return moment().startOf('day').add(i + 1, 'd')
    }
    const m = moment(d, formats)
    if (m.isValid()) {
      return m
    }
    this.error(`argument is not a date: ${d}`)
    return moment('2010-01-01')
  }

  renderReport(report, format, keys) {
    var justification = []
    switch (format) {
    case 'csv':
      csvRenderer.json2csvAsync(report, {
        delimiter: {field: ','},
        keys: keys,
      }).then(r => {
        this.log(r)
      })
      break
    case 'tsv':
      csvRenderer.json2csvAsync(report, {
        delimiter: {field: '\t'},
        keys: keys,
      }).then(r => {
        this.log(r)
      })
      break
    case 'mdt':
      justification = _.chain(report[0]).pick(keys).values().value().map(el => {
        // if the column is numeric, assume right justified
        return _.chain(el).toNumber().isNaN().value() ? 'l' : 'r'
      })
      this.log(markdownRenderer([keys].concat(report.map(r => {
        return _.chain(r).pick(keys).values(r).value()
      })), {align: justification}))
      break
    case 'txt': // fall through
    default:
      this.log(tableRenderer.getTable(report.map(row => {
        return _.pick(row, keys)
      })).replace(/\n+$/, '')) // trim trailing blank lines
    }
  }

  report2(db, a, b, format, verbose) {
    const stats = {
      inherited: {
        unresolved: db.prepare(`select count(1) count, group_concat(i.issueKey || ' (' || o.tdays || ')', ', ') tickets
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
        ])[0],

        resolved: db.prepare(`select count(1) count, group_concat(i.issueKey,', ') tickets
          from opsMeasure o
          join issues i on i.issue_ = o.issue_
          where i.issueCreatedStamp < ?
          and i.issueResolutionStamp between ? and ?`)
        .all([
          a.format('YYYY-MM-DDTHH:mm:ss'),
          a.format('YYYY-MM-DDTHH:mm:ss'),
          b.format('YYYY-MM-DDTHH:mm:ss'),
        ])[0],
      },
      created: {
        unresolved: db.prepare(`select count(1) count, group_concat(i.issueKey,', ') tickets
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
        ])[0],

        resolved: db.prepare(`select count(1) count, group_concat(i.issueKey,', ') tickets
          from opsMeasure o
          join issues i on i.issue_ = o.issue_
          where i.issueCreatedStamp between ? and ?
          and i.issueResolutionStamp between ? and ?`)
        .all([
          a.format('YYYY-MM-DDTHH:mm:ss'),
          b.format('YYYY-MM-DDTHH:mm:ss'),
          a.format('YYYY-MM-DDTHH:mm:ss'),
          b.format('YYYY-MM-DDTHH:mm:ss'),
        ])[0],
      },
      totals: {
        unresolved: db.prepare(`select count(1) count, group_concat(i.issueKey,', ') tickets
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
        ])[0],

        resolved: db.prepare(`select count(o.issue_) count, group_concat(i.issueKey,', ') tickets
          from opsMeasure o
          join issues i on i.issue_ = o.issue_
          where i.issueResolutionStamp between ? and ?`)
        .all([
          a.format('YYYY-MM-DDTHH:mm:ss'),
          b.format('YYYY-MM-DDTHH:mm:ss'),
        ])[0],
      },
    }
    let report = _.chain(stats).omit('totals').transform((a, v, k) => {
      a.push({type: k, unresolved: v.unresolved.count, unresolvedTickets: v.unresolved.tickets, resolved: v.resolved.count, resolvedTickets: v.resolved.tickets})
    }, []).value()
    this.renderReport(report, format, verbose ? _.keys(report[0]) : ['type', 'unresolved', 'unresolvedTickets'])
  }

  report1(db, a, b, format, verbose) {
    const rows = db.prepare(`select tdays, count(o.issue_) as count, group_concat(i.issueKey,', ') tickets
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
    const report = rows.map((r, i, a) => {
      if (i === 0) {
        r.sum = r.count
      } else {
        r.sum = r.count + a[i - 1].sum
      }
      r.percent = Math.round(10000.0 * r.count / total, 2) / 100.0
      r.cpercent = Math.round(10000.0 * r.sum / total, 2) / 100.0
      return r
    })
    this.renderReport(report, format, verbose ? ['tdays', 'count', 'sum', 'percent', 'cpercent', 'tickets'] : ['tdays', 'count', 'sum', 'percent', 'cpercent'])
  }

  async run() {
    const {flags} = this.parse(ReportCommand)
    const id = flags.id || 0
    const database = flags.db || (config.has('database') ? config.get('database') : ':memory:')
    const a = this.parseDateKeywords(flags.a || '-7')
    const b = this.parseDateKeywords(flags.b || 'eod')
    const db = sqlite3(database, {})
    const format = _.chain(['txt', 'mdt', 'csv', 'tsv']).find(f => {
      return f === (flags.format || 'txt')
    }).defaultTo('txt').value()

    if (flags.showRange) {
      this.log(`from : ${a.format('YYYY-MM-DD HH:mm:ss')}`)
      this.log(`to   : ${b.format('YYYY-MM-DD HH:mm:ss')}`)
      this.log(`diff : ${b.diff(a, 'days', true)} days`)
    }

    switch (id) {
    case 'sla':
    case '1':
      this.report1(db, a, b, format, flags.verbose)
      break
    case 'summary':
    case '2':
      this.report2(db, a, b, format, flags.verbose)
      break
    default:
      this.error(`report id not implemented : ${id}`)
    }
  }
}

ReportCommand.description = `Generate reports from local db
...
Extra documentation goes here
`

ReportCommand.flags = {
  db: flags.string({char: 'd', description: 'database to query'}),
  id: flags.string({char: 'i', description: 'id of report to generate'}),
  a: flags.string({char: 'a', description: 'start date'}),
  b: flags.string({char: 'b', description: 'end date'}),
  format: flags.string({char: 'f', description: 'output formats: [csv, txt, tsv, mdt]'}),
  verbose: flags.boolean({char: 'v', description: 'verbose output'}),
  showRange: flags.boolean({char: 'r', description: 'show date range'}),
}

module.exports = ReportCommand
