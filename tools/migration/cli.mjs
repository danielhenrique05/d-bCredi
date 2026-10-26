import { readFile, mkdir, lstat, writeFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeMigration } from './analysis.mjs';
import { publicConfig, localTargetConfig, readPublicSource, readTarget, checkPublicImages, InspectionError } from './io.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const fixture = name => new URL(`./fixtures/${name}.synthetic.json`, import.meta.url);
const readJson = async path => {
  const data = await readFile(path, 'utf8');
  if (Buffer.byteLength(data) > 32 * 1024 * 1024) throw new InspectionError('snapshot_file_limit');
  return JSON.parse(data);
};

export async function savePrivateReport(name, report, directory = resolve(root, '.dnb-migration')) {
  if (typeof name !== 'string' || basename(name) !== name || !/^[\w-]+\.json$/.test(name)) throw new InspectionError('report_filename_invalid');
  await mkdir(directory, { recursive: true });
  if ((await lstat(directory)).isSymbolicLink()) throw new InspectionError('report_directory_invalid');
  await writeFile(resolve(directory, name), JSON.stringify(report, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
}

export async function run(args, deps = {}) {
  const [command, ...rest] = args;
  if (!['inventory', 'dry-run'].includes(command)) throw new InspectionError('command_invalid');
  const options = {};
  for (let index = 0; index < rest.length; index += 1) {
    const option = rest[index];
    if (!['--source-env', '--target-env', '--source-file', '--target-file', '--mapping', '--objects', '--check-images', '--output'].includes(option) || option in options) throw new InspectionError('arguments_invalid');
    options[option] = option === '--check-images' ? true : rest[++index];
    if (options[option] === undefined || typeof options[option] === 'string' && options[option].startsWith('--')) throw new InspectionError('arguments_invalid');
  }
  if (options['--source-env'] && options['--source-file'] || options['--target-env'] && options['--target-file']) throw new InspectionError('arguments_invalid');
  const failures = [];
  const synthetic = !options['--source-env'] && !options['--source-file'];
  let source;
  try {
    if (options['--source-env']) {
      const config = publicConfig(parseEnv(await readFile(options['--source-env'], 'utf8')));
      source = await readPublicSource(config, deps.fetchImpl);
      source.origin = config.origin;
    } else {
      source = await readJson(options['--source-file'] ?? fixture('source'));
      if (options['--source-file']) source = { ...source, kind: 'snapshot', fullAccessConfirmed: false };
    }
  } catch (error) {
    if (error instanceof InspectionError && error.code === 'public_source_configuration_invalid') throw error;
    failures.push(error instanceof InspectionError ? error.code : 'source_file_invalid');
    source = { kind: 'unavailable', available: false, properties: [] };
  }
  let target;
  try {
    if (options['--target-env']) target = await readTarget(localTargetConfig(parseEnv(await readFile(options['--target-env'], 'utf8'))), deps.makeClient);
    else if (options['--target-file']) target = await readJson(options['--target-file']);
    else if (synthetic) target = await readJson(fixture('target'));
    else target = { available: false };
  } catch (error) {
    failures.push(error instanceof InspectionError ? error.code : 'target_file_invalid');
    target = { available: false };
  }
  const mappings = options['--mapping'] ? (await readJson(options['--mapping'])).mappings : [];
  const objects = options['--objects'] ? (await readJson(options['--objects'])).objects : null;
  if (!Array.isArray(mappings) || objects !== null && !Array.isArray(objects)) throw new InspectionError('manifest_invalid');
  const imageChecks = options['--check-images'] && source.origin
    ? await checkPublicImages(source.properties, source.origin, deps.fetchImpl) : [];
  const report = analyzeMigration({ source, target, mappings, objects, imageChecks });
  report.mode = command;
  // Somente códigos locais seguros; nunca serializar exceções/URLs de conexão.
  report.accessFailures = failures;
  if (options['--output']) await savePrivateReport(options['--output'], report);
  return { report, summary: { mode: command, readOnly: true, source: report.source, ...report.summary,
    images: { uniqueReferences: report.images.uniqueReferences, checked: report.images.checks.length,
      publicReadOk: report.images.checks.filter(item => item.status === 200).length, orphanAssessment: report.images.orphanAssessment },
    accessFailures: failures, privateReportSaved: Boolean(options['--output']) } };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { summary } = await run(process.argv.slice(2));
    console.log(JSON.stringify(summary, null, 2));
    // 2 significa simulação bloqueada/inspeção incompleta, não falha destrutiva.
    if (summary.blockingIssues || summary.accessFailures.length) process.exitCode = 2;
  } catch (error) {
    console.error(JSON.stringify({ readOnly: true, code: error instanceof InspectionError ? error.code : 'inspection_failed', message: 'Inspeção não concluída; confira os argumentos e a documentação. Nenhum dado foi importado.' }));
    process.exitCode = 1;
  }
}
