import { render } from '@create-figma-plugin/ui'
import { h } from 'preact'

import { App } from './components/App'
import { Scope } from './types'

interface PluginData {
  scope: Scope
  currentPageName: string
}

function Plugin(props: PluginData) {
  return <App scope={props.scope} currentPageName={props.currentPageName} />
}

export default render(Plugin)
