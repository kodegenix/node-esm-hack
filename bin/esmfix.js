#!/usr/bin/env node
import path from 'path'
import fs from "fs";
import { spawn } from 'child_process'

const node = process.argv[0]
const binFile = fs.realpathSync(process.argv[1])
const scriptFile = path.resolve(path.dirname(binFile), '../lib/cli.js')
const args = [...process.argv.slice(2)]

const p = spawn(node, ['--experimental-import-meta-resolve', scriptFile, ...args], {
    stdio: 'inherit'
})

p.on('error', (error) => {
    console.error(error)
})

p.on('close', (code) => {
    process.exit(code)
})
