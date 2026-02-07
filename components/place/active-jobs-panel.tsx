import { GiHammerNails } from 'react-icons/gi'
import { PlacePanel } from './place-panel'

export function ActiveJobsPanel() {
  return (
    <PlacePanel icon={<GiHammerNails size={22} />} title="Jobs en cours">
      <div />
    </PlacePanel>
  )
}
