#!/usr/bin/env node
import path from 'path'
import { Command } from 'commander'
import { processFiles } from './resolve.js'
import { createRequire } from 'module'

async function main() {
    try {
        const ver = createRequire(import.meta.url)('../package.json').version

        const prog = new Command('esmfix')
            .usage('[options] [command]')
            .option('-c, --cwd <path>', 'working directory', './')
            .version(ver, '-v, --version', 'output current version')

        prog.command('resolve', {isDefault: true})
            .description('resolve relative modules without extensions in import/export statements')
            .argument('<files...>', 'files to process, supports globs')
            .action(runCommand)

        prog.command('check')
            .description('check if import/export statements are correct for ESM')
            .argument('<files...>', 'files to check, supports globs')
            .action(runCommand)


        await prog.parseAsync(process.argv)
    } catch (err) {
        console.error(err.message)
        process.exit(2)
    }
}

async function runCommand(files) {
    const command = this
    const globals = command.parent.opts()

    if (globals.cwd) {
        process.chdir(globals.cwd)
    }

    const cmd = command.name()
    switch (cmd) {
        case 'resolve': {
            const res = await processFiles(files, true)
            if (res.filesOk) {
                console.info(`Processed ${res.filesProcessed} files, fixed ${res.resolves} in ${res.filesOk} files.`)
            }
            if (res.filesErr) {
                console.error(`Found ${res.errors} errors in ${res.filesErr} files.`)
                process.exit(1)
            }
            return
        }
        case 'check': {
            const res = await processFiles(files, false)
            console.info(`Processed ${res.filesProcessed} files.`)
            if (res.filesOk + res.filesErr > 0) {
                console.error(`Found ${res.resolves} invalid relative import/exports in ${res.filesOk + res.filesErr} files.`)
                process.exit(1)
            }
            return
        }
        default:
            throw new Error(`Unknown command: '${cmd}'`)
    }
}

main().catch((err) => {
    console.error(err.message)
    process.exit(2)
})
