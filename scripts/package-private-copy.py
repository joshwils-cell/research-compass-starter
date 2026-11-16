"""Package committed, unconfigured public starter source; never package a live instance."""
import io
import hashlib
import json
import subprocess
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def git(*args):
    return subprocess.check_output(['git', '-C', str(ROOT), *args])

def package():
    if git('status', '--porcelain', '--untracked-files=normal').strip():
        raise SystemExit('Commit the reviewed starter source first.')
    settings = json.loads(git('show', 'HEAD:.openai/hosting.json'))
    if settings.get('project_id') is not None:
        raise SystemExit('Refusing to package a configured deployment. Release only an unbound public starter.')
    commit = git('rev-parse', 'HEAD').decode().strip()
    source_bytes = git('archive', '--format=zip', 'HEAD')
    output = ROOT / 'outputs' / 'Research-Compass-Starter.zip'
    output.parent.mkdir(exist_ok=True)
    count = 0
    with zipfile.ZipFile(io.BytesIO(source_bytes)) as source, zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as target:
        for entry in source.infolist():
            if entry.is_dir():
                continue
            name = entry.filename
            parts = Path(name).parts
            if any(part in {'.git','node_modules','.wrangler','.sites-runtime','.test-data','.next','.vinext','coverage','dist','outputs','work','.codex','.agents'} for part in parts):
                raise SystemExit('Runtime file in committed source: ' + name)
            if any(part.startswith(('.env','.dev.vars')) for part in parts) or name.endswith(('.pem','.sqlite','.sqlite-wal','.sqlite-shm','.db','.rrsetup.json','.log','.xml')):
                raise SystemExit('Private/runtime file in committed source: ' + name)
            data = source.read(entry)
            if name == 'STARTER-PROVENANCE.json':
                data = (json.dumps({'source_commit':commit,'distribution':'public-private-copy-starter','hosting_identity':None,'contains_live_data':False}, indent=2)+'\n').encode()
            target.writestr(name, data)
            count += 1
    with zipfile.ZipFile(output) as archive:
        assert json.loads(archive.read('.openai/hosting.json'))['project_id'] is None
        assert 'LICENSE' in archive.namelist()
        assert 'PRIVATE-COPY-START-HERE.md' in archive.namelist()
    print(output)
    checksum = hashlib.sha256(output.read_bytes()).hexdigest()
    checksum_file = output.with_suffix('.zip.sha256')
    checksum_file.write_text(f'{checksum}  {output.name}\n', encoding='utf-8')
    print(checksum_file)
    print(f'Packaged {count} committed files with an unset Site ID and included license. No Git history, dependencies, or runtime directories were packaged.')

if __name__ == '__main__':
    package()
