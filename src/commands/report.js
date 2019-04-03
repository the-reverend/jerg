const {Command, flags} = require('@oclif/command')

class ReportCommand extends Command {
  async run() {
    const {flags} = this.parse(ReportCommand)
    const name = flags.name || 'world'
    this.log(`hello ${name} from /Users/rwilson1/src/manage/jerg/src/commands/report.js`)
  }
}

ReportCommand.description = `Describe the command here
...
Extra documentation goes here
`

ReportCommand.flags = {
  name: flags.string({char: 'n', description: 'name to print'}),
}

module.exports = ReportCommand
