// WebChat.jsx — the "Automation" nav entry for the Web Chat channel. Holds only
// flow creation; widget appearance/question types/settings live in
// WebChatAppearance.jsx (nav: "Appearance"), and install instructions live in the
// shared Installation.jsx page (nav: "Installation").
import WebChatFlowBuilder from './WebChatFlowBuilder'

export default function WebChat() {
  return <WebChatFlowBuilder/>
}
