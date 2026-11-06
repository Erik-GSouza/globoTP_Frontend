import ts from "typescript"
import { mkdtemp, mkdir, readFile, writeFile, rm, readdir } from "node:fs/promises"
import { resolve, dirname, join } from "node:path"
import { spawnSync } from "node:child_process"
const root = process.cwd()
const temporary = await mkdtemp(join(root, ".test-build-"))
const files = ["models/formatted-text", "models/script.model", "presentation/speech-alignment", "presentation/speech.service", "presentation/presentation.service", "presentation/presentation.model", "presentation/presentation-id", "presentation/projection.protocol", "core/api-client.service"]
try {
  await writeFile(join(temporary, "package.json"), '{"type":"module"}')
  for (const file of files) {
    const source = await readFile(join(root, "src/app", file + ".ts"), "utf8")
    const result = ts.transpileModule(source, { reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022, experimentalDecorators: true } })
    if (result.diagnostics?.some(diagnostic => diagnostic.category === ts.DiagnosticCategory.Error)) {
      throw new Error(`${file}: ${result.diagnostics.map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')).join('\n')}`)
    }
    const output = result.outputText
      .replace(/from "(\.[^"]+)"/g, 'from "$1.js"')
    const destination = join(temporary, file + ".js")
    await mkdir(dirname(destination), { recursive: true }); await writeFile(destination, output)
  }
  const tests = (await readdir("tests")).filter(f => f.endsWith(".test.mjs")).map(f => resolve("tests", f))
  const result = spawnSync(process.execPath, ["--test", ...tests], { stdio: "inherit", env: { ...process.env, TEST_MODULE_ROOT: temporary } })
  process.exitCode = result.status ?? 1
} finally { await rm(temporary, { recursive: true, force: true }) }
