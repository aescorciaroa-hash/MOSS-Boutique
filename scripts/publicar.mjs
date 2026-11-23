// Compila la tienda y la publica en la rama "deploy" de GitHub.
// Hostinger (Git con implementación automática) descarga esa rama en public_html.
// Uso: npm run publicar
import { execSync } from 'node:child_process'
import { cpSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const run = (cmd, opts = {}) => execSync(cmd, { stdio: 'inherit', ...opts })
const out = (cmd, opts = {}) => execSync(cmd, { encoding: 'utf8', ...opts }).trim()

const remote = out('git remote get-url origin')
const source = out('git rev-parse --short HEAD')
const dirty = out('git status --porcelain')
if (dirty) console.warn('\n⚠ Hay cambios sin guardar en git. Se publicará lo que está en la carpeta, pero recuerda hacer commit y push a main.\n')

console.log('› Compilando…')
run('npm run build')
const api = ['index.php', 'lib.php', '.htaccess', 'config.example.php']
for (const f of api) cpSync(join('api', f), join('dist', 'api', f))

const tmp = mkdtempSync(join(tmpdir(), 'moss-deploy-'))
try {
  cpSync('dist', tmp, { recursive: true })
  const g = { cwd: tmp }
  run('git init -q -b deploy', g)
  run(`git remote add origin "${remote}"`, g)
  run('git add -A', g)
  run(`git -c user.name="${out('git config user.name')}" -c user.email="${out('git config user.email')}" commit -q -m "Publicación desde ${source}"`, g)
  console.log('› Subiendo a la rama deploy…')
  run('git push -q --force origin deploy', g)
  console.log('\n✓ Publicado. Hostinger lo descargará en unos segundos.\n')
} finally {
  rmSync(tmp, { recursive: true, force: true })
}
