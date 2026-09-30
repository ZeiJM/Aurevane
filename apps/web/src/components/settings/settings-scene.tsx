import type { ReactNode } from 'react'
import { AurevaneImage } from '@/components/media/aurevane-image'
import type { ImageAssetId } from '@/media/registry'
import styles from './settings-scene.module.css'

export function SettingsScene({
  title,
  description,
  assetId = 'environment.archive.interior',
  children,
}: {
  title: string
  description: string
  assetId?: ImageAssetId
  children: ReactNode
}) {
  return (
    <section className={styles.scene} data-settings-scene>
      <AurevaneImage assetId={assetId} className={styles.art} sizes="85vw" />
      <header className={styles.heading}>
        <h1>{title}</h1>
        <p>{description}</p>
      </header>
      <div className={styles.workspace}>{children}</div>
    </section>
  )
}
