// Modals render into document.body, outside the .theme-instagram wrapper that
// supplies the pink accent variables — so re-apply the theme inside the portal.
import { createPortal } from 'react-dom'

export default function igPortal(node) {
  return createPortal(<div className="theme-instagram">{node}</div>, document.body)
}
