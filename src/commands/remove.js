const {Command, flags} = require('@oclif/command')

const sqlite3 = require('better-sqlite3')
const config = require('config')

class RemoveCommand extends Command {
  async run() {
    const {flags} = this.parse(RemoveCommand)
    const database = flags.db || (config.has('database') ? config.get('database') : ':memory:')
    const db = sqlite3(database, {})
    if (flags.issue) {
      this.log(`deleting issue ${flags.issue}`)
      db.prepare('delete from issueStatusLog where issue_ in (select issue_ from issues where issueKey = ?)').run([flags.issue])
      db.prepare('delete from issues where issueKey = ?').run([flags.issue])
    } else {
      this.log('please supply an issue to remove')
    }
  }
}

RemoveCommand.description = 'Remove issues from local db'

RemoveCommand.flags = {
  issue: flags.string({char: 'i', description: 'issue to remove from db'}),
  db: flags.string({char: 'd', description: 'database to update'}),
}

module.exports = RemoveCommand
