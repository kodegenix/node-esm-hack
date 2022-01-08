import path from 'path'
import fs from 'fs-extra'
import glob from 'glob'

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


const RE = /^(import|export)\s+(.+?)\s+from\s+['"](\..+?)['"];?$/

function resolveModules(filePath, src, fileSet, save) {
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
            let moduleFile = path.resolve(path.dirname(filePath), module);
            let moduleExt = path.extname(moduleFile);
            if (moduleExt === '.js') {
                if (save) {
                    dst.push(line);
                }
            } else if (moduleExt === '') {
                let resolvedModule = null;
                let p = moduleFile + '.js';
                if (fileSet.has(p)) {
                    resolvedModule = module + '.js';
                } else {
                    let p = path.join(moduleFile, 'index.js')
                    if (fileSet.has(p)) {
                        resolvedModule = path.join(module, 'index.js');
                    }
                }
                if (resolvedModule) {
                    if (save) {
                        line = keyword + ' ' + expr + ' from \'' + resolvedModule + '\'';
                        dst.push(line);
                        changes = true;
                        console.info(`info: at ${filePath}:${lineno}: resolved module '${module}' to '${resolvedModule}'`);
                    } else {
                        resolves++;
                        console.info(`info: at ${filePath}:${lineno}: module '${module}' should be resolved to '${resolvedModule}'`);
                    }
                } else {
                    console.error(`error: at ${filePath}:${lineno}: unresolved module '${module}'`);
                    errors++;
                }
            } else {
                console.error(`error: at ${filePath}:${lineno}: unsupported extension '${moduleExt}' in module '${module}'`);
                errors++;
            }
        } else {
            if (save) {
                dst.push(line)
            }
        }
        lineno++;
    }
    return {
        resolves,
        errors,
        src: (save && changes && errors === 0) ? dst.join('\n') : null
    }
}

export async function processFiles(patterns, save) {
    const files = await listFiles(patterns)
    const fileSet = new Set(files)

    let errors = 0
    let resolves = 0
    let filesErr = 0
    let filesOk = 0
    for (const file of files) {
        let src = (await fs.readFile(file)).toString()

        const result = resolveModules(file, src, fileSet)
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