import path from 'path'
import fs from 'fs-extra'
import glob from 'glob'
import {moduleResolve} from "import-meta-resolve"

async function listFiles(patterns, filter, ignore) {
    const globOptions = {
        absolute: true,
        nodir: true,
        ignore
    }
    let allFiles = new Set()
    for (let p of patterns) {
        if (!glob.hasMagic(p)) {
            let stat = await fs.stat(p).catch(() => null)
            if (stat && stat.isDirectory()) {
                p += '/**/' + (filter ? filter : '*')
            }
        }
        await new Promise((resolve, reject) => {
            glob(p, globOptions, (err, files) => {
                if (err) {
                    reject(err)
                } else {
                    files.forEach(f => allFiles.add(f))
                    resolve()
                }
            })
        })
    }

    return Array.from(allFiles).sort((a, b) => a.localeCompare(b))
}


const RE = /^(import|export)\s+(.+?)\s+from\s+['"](.+?)['"];?$/

async function resolveModulePath(filePath, module) {
    async function tryResolve(module, filePath) {
        await moduleResolve(module, filePath)
        return module
    }

    // root modules are always returned as they are
    if (!module.startsWith('.') && module.indexOf('/') === -1) {
        return module
    }
    filePath = 'file://' + filePath
    let error = null
    try {
        return await tryResolve(module, filePath)
    } catch (err) {
        error = err
    }
    try {
        return await tryResolve(module + '/index.js', filePath)
    } catch (err) {
        error = err
    }
    try {
        return await tryResolve(module + '/index.mjs', filePath)
    } catch (err) {
        error = err
    }
    try {
        return await tryResolve(module + '.js', filePath)
    } catch (err) {
        error = err
    }
    try {
        return await tryResolve(module + '.mjs', filePath)
    } catch (err) {
        error = err
    }
    throw error
}

async function resolveModules(filePath, src, save) {
    let errors = 0;
    let resolves = 0;
    let changes = false;
    let dst = [];
    let lineno = 1;
    for (let line of src.split(/\r?\n/)) {
        const match = line.match(RE);
        if (match) {
            const keyword = match[1];
            const expr = match[2];
            const module = match[3];
            let moduleExt = path.extname(module);
            if (moduleExt === '.js') {
                if (save) {
                    dst.push(line);
                }
            } else {
                try {
                    let resolvedModule = await resolveModulePath(filePath, module)
                    if (save) {
                        line = keyword + ' ' + expr + ' from \'' + resolvedModule + '\''
                        dst.push(line)
                    }
                    if (resolvedModule !== module) {
                        if (save) {
                            changes = true
                            console.info(`info: at ${filePath}:${lineno}: resolved module '${module}' to '${resolvedModule}'`)
                        } else {
                            resolves++
                            console.info(`info: at ${filePath}:${lineno}: module '${module}' should be resolved to '${resolvedModule}'`);
                        }
                    } else {

                    }
                }
                catch (err) {
                    console.error(`error: at ${filePath}:${lineno}: error resolving '${module}'`)
                    console.error(err)
                    errors++
                }
            }
        } else {
            if (save) {
                dst.push(line)
            }
        }
        lineno++
    }
    return {
        resolves,
        errors,
        src: (save && changes && errors === 0) ? dst.join('\n') : null
    }
}

export async function processFiles(patterns, save) {
    const files = await listFiles(patterns)

    let errors = 0
    let resolves = 0
    let filesErr = 0
    let filesOk = 0
    for (const file of files) {
        let src = (await fs.readFile(file)).toString()

        const result = await resolveModules(file, src, save)
        if (save && result.src) {
            await fs.writeFile(file, result.src, "utf-8")
        }
        errors += result.errors
        resolves += result.resolves
        if (result.errors) {
            filesErr++
        } else if (result.resolves) {
            filesOk++
        }
    }

    return {
        filesProcessed: files.length,
        filesOk,
        filesErr,
        errors,
        resolves,
    }
}
