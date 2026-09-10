// Provider-specific result rows were removed with the bring-your-own-key flow; every check has one shared result.
const providers = []
const statuses = { pending: 'Not tested', pass: 'Pass', fail: 'Fail', blocked: 'Blocked' }
const environmentKeys = ['build', 'figma', 'os', 'scope', 'models']
const maxImageBytes = 15 * 1024 * 1024
const maxImages = 10
const $ = id => document.getElementById(id)
const records = new Map()
const openEvidence = new Set()
let sections = []
let activeSection = 0
let database
let environment = {}
let saveQueue = Promise.resolve()
let imageQueue = Promise.resolve()
let pendingWrites = 0
let storageFailed = false

function element(tag, className, text) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

function notice(message) {
  $('notice').textContent = message
  $('notice').hidden = !message
}

function storageError() {
  storageFailed = true
  $('save-status').textContent = 'Not saved · export a backup'
  notice('Browser storage could not save your latest changes. They are still on this page. Export a backup before closing it; browser storage may be full or unavailable.')
}

async function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('description-generator-release-qa', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('results', { keyPath: 'id' })
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close()
      resolve(request.result)
    }
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('Close other checklist tabs and try again.'))
  })
}

function transaction(values) {
  return new Promise((resolve, reject) => {
    const tx = database.transaction('results', 'readwrite')
    for (const value of values) tx.objectStore('results').put(value)
    tx.oncomplete = resolve
    tx.onabort = () => reject(tx.error)
    tx.onerror = () => reject(tx.error)
  })
}

function save(values) {
  const snapshot = structuredClone(values)
  pendingWrites++
  $('save-status').textContent = 'Saving…'
  saveQueue = saveQueue.then(() => transaction(snapshot)).catch(storageError).finally(() => {
    pendingWrites--
    if (!pendingWrites && !storageFailed) $('save-status').textContent = 'Saved in this browser'
    if (!pendingWrites && storageFailed) $('save-status').textContent = 'Not saved · export a backup'
  })
  return saveQueue
}

function resultFor(test, provider) {
  const id = `${test.id}:${provider || 'shared'}`
  if (!records.has(id)) records.set(id, {
    id, status: test.checked ? 'pass' : 'pending',
    notes: test.checked ? 'Already checked in the source Markdown checklist.' : '',
    screenshots: [], title: test.text, section: test.section, provider,
    updatedAt: null,
  })
  return records.get(id)
}

function updateResult(result, changes) {
  Object.assign(result, changes, { updatedAt: new Date().toISOString() })
  save([result])
  renderProgress()
}

function providersFor() {
  return ['']
}

async function parseChecklist(markdown) {
  const parsed = []
  let section
  for (const line of markdown.split(/\r?\n/)) {
    if (line.startsWith('## ')) {
      section = { title: line.slice(3), description: [], tests: [] }
      parsed.push(section)
    } else if (section) {
      const match = line.match(/^- \[([ xX])\] (.+)$/)
      if (match) {
        const text = match[2]
        // Content-derived IDs prevent reordered checks from inheriting someone else's result.
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${section.title}\n${text}`))
        const id = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('').slice(0, 24)
        section.tests.push({ id, text, section: section.title, checked: match[1].toLowerCase() === 'x', providers: providersFor(section.title, text) })
      } else if (line.trim()) section.description.push(line)
    }
  }
  return parsed
}

function allResults(sectionList = sections) {
  return sectionList.flatMap(section => section.tests.flatMap(test => test.providers.map(provider => resultFor(test, provider))))
}

function counts(results) {
  const count = { pending: 0, pass: 0, fail: 0, blocked: 0 }
  for (const result of results) count[result.status]++
  return count
}

function renderProgress() {
  const results = allResults()
  const count = counts(results)
  $('passed').textContent = `${count.pass} / ${results.length} passed`
  $('reviewed').textContent = `${results.length - count.pending} reviewed · ${count.pending} not tested`
  $('breakdown').textContent = `${count.fail} failed · ${count.blocked} blocked`
  $('progress').value = count.pass
  $('progress').max = results.length || 1
  $('sections').replaceChildren()
  sections.forEach((section, index) => {
    const results = allResults([section])
    const count = counts(results)
    const button = element('button')
    button.append(element('span', '', section.title), element('span', 'count', `${count.pass}/${results.length}`))
    if (index === activeSection) button.setAttribute('aria-current', 'page')
    button.addEventListener('click', () => {
      activeSection = index
      renderProgress()
      renderChecks()
    })
    $('sections').append(button)
  })
  const current = allResults([sections[activeSection]])
  $('section-count').textContent = `${counts(current).pass} of ${current.length} passed`
}

function matches(result) {
  const filter = $('filter').value
  const query = $('search').value.trim().toLowerCase()
  return (filter === 'all' || filter === result.status || (filter === 'issues' && ['fail', 'blocked'].includes(result.status)))
    && (!query || `${result.title} ${result.provider} ${result.notes}`.toLowerCase().includes(query))
}

function renderAttachments(container, result) {
  container.replaceChildren()
  for (const screenshot of result.screenshots) {
    const figure = element('figure', 'attachment')
    const button = element('button', 'thumbnail')
    button.setAttribute('aria-label', `Open screenshot: ${screenshot.name}`)
    const image = element('img')
    image.src = screenshot.data
    image.alt = screenshot.name
    image.loading = 'lazy'
    button.append(image)
    button.addEventListener('click', () => {
      $('preview-name').textContent = screenshot.name
      $('preview-image').src = screenshot.data
      $('preview').showModal()
    })
    const remove = element('button', 'remove', 'Remove screenshot')
    remove.setAttribute('aria-label', `Remove screenshot: ${screenshot.name}`)
    remove.addEventListener('click', () => {
      if (!confirm(`Remove “${screenshot.name}” from this check?`)) return
      updateResult(result, { screenshots: result.screenshots.filter(item => item.id !== screenshot.id) })
      renderAttachments(container, result)
      updateEvidenceLabel(result)
    })
    figure.append(button, element('figcaption', '', screenshot.name), remove)
    container.append(figure)
  }
}

function updateEvidenceLabel(result) {
  const summary = document.querySelector(`[data-result-id="${result.id}"] .evidence summary`)
  if (summary) summary.textContent = `Notes & screenshots${result.notes ? ' · has notes' : ''}${result.screenshots.length ? ` · ${result.screenshots.length} image${result.screenshots.length === 1 ? '' : 's'}` : ''}`
}

function readImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`))
    reader.readAsDataURL(file)
  })
}

async function validateImage(data) {
  if (!/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/.test(data) || data.length > maxImageBytes * 1.34 + 100) throw new Error('Use PNG, JPG, WebP, or GIF images up to 15 MB each.')
  const image = new Image()
  image.src = data
  try { await image.decode() } catch { throw new Error('One of the screenshots is not a readable image.') }
}

function attach(result, files, container) {
  const selected = Array.from(files)
  imageQueue = imageQueue.then(async () => {
    if (!selected.length) return
    if (result.screenshots.length + selected.length > maxImages) throw new Error('A check can hold up to 10 screenshots. Remove one before adding more.')
    $('save-status').textContent = 'Adding screenshots…'
    const screenshots = []
    for (const file of selected) {
      if (file.size > maxImageBytes) throw new Error(`${file.name} is larger than 15 MB.`)
      const data = await readImage(file)
      await validateImage(data)
      screenshots.push({ id: crypto.randomUUID(), name: file.name || 'Pasted screenshot.png', data })
    }
    updateResult(result, { screenshots: [...result.screenshots, ...screenshots] })
    renderAttachments(container, result)
    updateEvidenceLabel(result)
  }).catch(error => {
    notice(error.message)
    $('save-status').textContent = storageFailed ? 'Not saved · export a backup' : 'Saved in this browser'
  })
  return imageQueue
}

function renderResult(test, provider) {
  const result = resultFor(test, provider)
  const row = element('div', 'result')
  row.dataset.status = result.status
  row.dataset.resultId = result.id
  const top = element('div', 'result-top')
  top.append(element('span', 'result-label', provider || 'Result'))
  const buttons = element('div', 'statuses')
  buttons.setAttribute('role', 'group')
  buttons.setAttribute('aria-label', `${provider || 'Check'} result: ${test.text}`)
  for (const [value, label] of Object.entries(statuses)) {
    const button = element('button', '', label)
    button.dataset.value = value
    button.setAttribute('aria-pressed', String(result.status === value))
    button.addEventListener('click', () => {
      updateResult(result, { status: value })
      row.dataset.status = value
      for (const other of buttons.children) other.setAttribute('aria-pressed', String(other.dataset.value === value))
      if (value === 'fail' || value === 'blocked') {
        evidence.open = true
        openEvidence.add(result.id)
      }
      // Retain focus on the changed row. Filters are reapplied on the next navigation/filter action.
    })
    buttons.append(button)
  }
  top.append(buttons)
  const evidence = element('details', 'evidence')
  evidence.open = openEvidence.has(result.id) || ['fail', 'blocked'].includes(result.status)
  evidence.addEventListener('toggle', () => evidence.open ? openEvidence.add(result.id) : openEvidence.delete(result.id))
  evidence.append(element('summary', '', `Notes & screenshots${result.notes ? ' · has notes' : ''}${result.screenshots.length ? ` · ${result.screenshots.length} image${result.screenshots.length === 1 ? '' : 's'}` : ''}`))
  const content = element('div', 'evidence-content')
  const label = element('label', '', 'Notes · what happened?')
  const notes = element('textarea')
  notes.value = result.notes
  notes.placeholder = 'What you tried, what you expected, and what happened. Include the service URL if relevant.'
  notes.addEventListener('input', () => {
    updateResult(result, { notes: notes.value })
    updateEvidenceLabel(result)
  })
  label.append(notes)
  const attachments = element('div', 'attachments')
  renderAttachments(attachments, result)
  const dropzone = element('div', 'dropzone')
  dropzone.tabIndex = 0
  dropzone.setAttribute('aria-label', 'Screenshot drop and paste area')
  const choose = element('button', '', 'Add screenshots')
  const input = element('input')
  input.type = 'file'
  input.accept = 'image/png,image/jpeg,image/webp,image/gif'
  input.multiple = true
  input.hidden = true
  input.setAttribute('aria-label', `Screenshots for ${provider || 'this check'}`)
  choose.addEventListener('click', () => input.click())
  input.addEventListener('change', () => {
    attach(result, input.files, attachments)
    input.value = ''
  })
  dropzone.addEventListener('dragover', event => { event.preventDefault(); dropzone.classList.add('drag') })
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag'))
  dropzone.addEventListener('drop', event => {
    event.preventDefault()
    dropzone.classList.remove('drag')
    attach(result, event.dataTransfer.files, attachments)
  })
  dropzone.addEventListener('paste', event => {
    const files = Array.from(event.clipboardData.items).filter(item => item.kind === 'file').map(item => item.getAsFile()).filter(Boolean)
    if (files.length) { event.preventDefault(); attach(result, files, attachments) }
  })
  dropzone.append(choose, input, element('p', '', 'Choose or drop images here. Focus this area to paste a screenshot. PNG, JPG, WebP, or GIF · 15 MB each · up to 10.'), element('p', '', 'Leave API keys and confidential designs out of screenshots.'))
  content.append(label, attachments, dropzone)
  evidence.append(content)
  row.append(top, evidence)
  return row
}

function renderChecks() {
  const section = sections[activeSection]
  $('section-index').textContent = `Section ${activeSection + 1} of ${sections.length}`
  $('section-title').textContent = section.title
  $('section-description').textContent = section.description.join(' ').replaceAll('`', '')
  $('checks').replaceChildren()
  section.tests.forEach((test, index) => {
    const visible = test.providers.filter(provider => matches(resultFor(test, provider)))
    if (!visible.length) return
    const card = element('article', 'check')
    card.dataset.testId = test.id
    const title = element('h3', 'check-title')
    title.append(element('span', 'check-number', `CHECK ${String(index + 1).padStart(2, '0')}`), document.createTextNode(test.text.replaceAll('`', '')))
    card.append(title)
    for (const provider of visible) card.append(renderResult(test, provider))
    $('checks').append(card)
  })
  $('empty').hidden = $('checks').children.length !== 0
  $('previous').disabled = activeSection === 0
  $('next').disabled = activeSection === sections.length - 1
}

function renderEnvironment() {
  for (const key of environmentKeys) $(key).value = environment[key] || ''
  $('environment-summary').textContent = [environment.build, environment.figma, environment.os].filter(Boolean).join(' · ') || 'Add build, Figma version, and OS'
}

async function exportBackup() {
  await imageQueue
  await saveQueue
  const data = {
    format: 'description-generator-qa', version: 1, exportedAt: new Date().toISOString(),
    environment, entries: Array.from(records.values()),
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = element('a')
  link.href = url
  link.download = `description-generator-qa-${new Date().toISOString().replaceAll(':', '-').slice(0, 19)}.json`
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}

async function validateBackup(data) {
  if (data?.format !== 'description-generator-qa' || data.version !== 1 || !Array.isArray(data.entries) || data.entries.length > 2000) throw new Error('This is not a supported Description Generator QA backup.')
  const ids = new Set()
  const entries = []
  for (const entry of data.entries) {
    if (!/^[a-f0-9]{24}:(shared|OpenAI|Anthropic|Google|OpenRouter)$/.test(entry.id) || ids.has(entry.id)
      || !Object.hasOwn(statuses, entry.status) || typeof entry.notes !== 'string' || entry.notes.length > 100000
      || !Array.isArray(entry.screenshots) || entry.screenshots.length > maxImages
      || typeof entry.title !== 'string' || typeof entry.section !== 'string' || !['', ...providers].includes(entry.provider)) throw new Error('The backup contains an invalid or duplicate result. Nothing was imported.')
    ids.add(entry.id)
    const screenshots = []
    for (const image of entry.screenshots) {
      if (typeof image.name !== 'string' || image.name.length > 500 || typeof image.data !== 'string') throw new Error('The backup contains an invalid screenshot.')
      await validateImage(image.data)
      screenshots.push({ id: crypto.randomUUID(), name: image.name, data: image.data })
    }
    entries.push({ id: entry.id, status: entry.status, notes: entry.notes, screenshots, title: entry.title, section: entry.section, provider: entry.provider, updatedAt: typeof entry.updatedAt === 'string' ? entry.updatedAt : null })
  }
  const fields = {}
  for (const key of environmentKeys) {
    if (data.environment?.[key] !== undefined && typeof data.environment[key] !== 'string') throw new Error('The backup contains invalid test environment details.')
    fields[key] = (data.environment?.[key] || '').slice(0, 5000)
  }
  return { entries, fields }
}

async function importBackup(file) {
  if (!file) return
  if (file.size > 200 * 1024 * 1024) throw new Error('This backup is larger than the 200 MB import limit.')
  const { entries, fields } = await validateBackup(JSON.parse(await file.text()))
  const imageCount = entries.reduce((sum, entry) => sum + entry.screenshots.length, 0)
  $('import-description').textContent = `${entries.length} results and ${imageCount} screenshot${imageCount === 1 ? '' : 's'} are ready to restore.`
  const dialog = $('import-confirm')
  dialog.returnValue = 'cancel'
  const confirmed = new Promise(resolve => dialog.addEventListener('close', () => resolve(dialog.returnValue === 'restore'), { once: true }))
  dialog.showModal()
  if (!await confirmed) return
  await imageQueue
  await saveQueue
  const nextEnvironment = { ...environment, ...fields }
  // Commit the complete import atomically before changing the visible state.
  await transaction([...entries, { id: 'environment', fields: nextEnvironment }])
  for (const entry of entries) records.set(entry.id, entry)
  environment = nextEnvironment
  renderEnvironment()
  renderProgress()
  renderChecks()
  const known = new Set(allResults().map(result => result.id))
  const older = entries.filter(entry => !known.has(entry.id)).length
  notice(`Backup restored.${older ? ` ${older} results belong to older or changed checklist items; they remain in your backups but are not counted in this checklist.` : ''}`)
}

async function start() {
  const response = await fetch('/qa-checklist.md')
  if (!response.ok) throw new Error('Could not load the source checklist.')
  sections = await parseChecklist(await response.text())
  if (!sections.length || !sections.some(section => section.tests.length)) throw new Error('No checks were found in the Markdown source.')
  try {
    database = await openDatabase()
    const saved = await new Promise((resolve, reject) => {
      const request = database.transaction('results').objectStore('results').getAll()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    for (const result of saved) {
      if (result.id === 'environment') environment = result.fields
      else records.set(result.id, result)
    }
    $('save-status').textContent = 'Saved in this browser'
  } catch { storageError() }
  renderEnvironment()
  renderProgress()
  renderChecks()
  const known = new Set(allResults().map(result => result.id))
  const older = Array.from(records.values()).filter(result => !known.has(result.id) && result.status !== 'pending').length
  if (older && !storageFailed) notice(`${older} saved results belong to changed or removed checks. They remain in backups; changed checks start as Not tested.`)
  for (const key of environmentKeys) $(key).addEventListener('input', () => {
    environment[key] = $(key).value
    save([{ id: 'environment', fields: environment }])
    $('environment-summary').textContent = [environment.build, environment.figma, environment.os].filter(Boolean).join(' · ') || 'Add build, Figma version, and OS'
  })
  for (const id of ['search', 'filter']) $(id).addEventListener('input', renderChecks)
  $('previous').addEventListener('click', () => { activeSection--; renderProgress(); renderChecks(); $('section-title').scrollIntoView({ block: 'start' }) })
  $('next').addEventListener('click', () => { activeSection++; renderProgress(); renderChecks(); $('section-title').scrollIntoView({ block: 'start' }) })
  $('export').disabled = false
  $('import').disabled = !database
  $('export').addEventListener('click', () => exportBackup().catch(error => notice(error.message)))
  $('import').addEventListener('click', () => $('import-file').click())
  $('import-file').addEventListener('change', () => {
    importBackup($('import-file').files[0]).catch(error => notice(`Could not import backup: ${error.message}`))
    $('import-file').value = ''
  })
  window.addEventListener('beforeunload', event => { if (pendingWrites || storageFailed) { event.preventDefault(); event.returnValue = '' } })
  document.addEventListener('dragover', event => event.preventDefault())
  document.addEventListener('drop', event => event.preventDefault())
}

start().catch(error => { notice(error.message); $('save-status').textContent = 'Checklist unavailable' })
