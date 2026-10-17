'use client'

import { useState } from 'react'

import type { ChatMessage } from './chat-api'
import { extractEmbeds, mentionsName, segmentMentions, type ChatEmbed } from './chat-format'
import styles from './chat.module.css'

export const REACTION_CHOICES = ['❤️', '🔥', '⚔️', '😮', '😂', '👏'] as const

const NAME_COLORS = ['#7fd0c2', '#e0b46a', '#e59aa8', '#8fb4ff', '#b7d98a', '#f0a050', '#c9a0e8']

export function nameColor(name: string): string {
  let hash = 0
  for (const character of name) hash = (hash * 31 + character.charCodeAt(0)) >>> 0
  return NAME_COLORS[hash % NAME_COLORS.length]!
}

function time(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function Embed({ embed }: { embed: ChatEmbed }) {
  const [playing, setPlaying] = useState(false)
  if (embed.kind === 'image') {
    return (
      <span className={styles.embed}>
        {/* Player-shared media from allowlisted hosts only; no referrer is sent. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={embed.url}
          alt="Shared image or GIF"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      </span>
    )
  }
  return (
    <span className={styles.embed}>
      {playing ? (
        <span className={styles.video}>
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${embed.videoId}?autoplay=1&rel=0`}
            title="Shared YouTube video"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            referrerPolicy="no-referrer"
          />
        </span>
      ) : (
        <button
          type="button"
          className={styles.video}
          onClick={() => setPlaying(true)}
          aria-label="Play shared YouTube video"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://i.ytimg.com/vi/${embed.videoId}/hqdefault.jpg`}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
          />
          <span aria-hidden="true">▶</span>
        </button>
      )}
    </span>
  )
}

export function ChatLine({
  message,
  grouped,
  selfName,
  knownNames,
  showEmbeds,
  onReply,
  onReact,
}: {
  message: ChatMessage
  grouped: boolean
  selfName: string
  knownNames: readonly string[]
  showEmbeds: boolean
  onReply: (message: ChatMessage) => void
  onReact?: (message: ChatMessage, emoji: string) => void
}) {
  const [reactionsOpen, setReactionsOpen] = useState(false)
  if (message.kind !== 'chat') {
    return (
      <div
        className={`${styles.row} ${message.kind === 'system' ? styles.system : styles.story}`}
        role="status"
      >
        <div className={styles.content}>
          {message.kind === 'story' ? <span className={styles.tag}>STORY</span> : null}
          {message.body}
        </div>
      </div>
    )
  }
  const name = message.senderName ?? 'Unknown'
  const { text, embeds } = extractEmbeds(message.body, showEmbeds)
  const segments = segmentMentions(text, [...knownNames, selfName], selfName)
  const mentioned = mentionsName(message.body, selfName)
  return (
    <div
      className={styles.row}
      data-chat-message-id={message.id}
      data-grouped={grouped || undefined}
      data-mention={mentioned || undefined}
    >
      {grouped ? (
        <span className={styles.avatarSpacer} />
      ) : (
        <span className={styles.avatar} style={{ color: nameColor(name) }} aria-hidden="true">
          {name.charAt(0).toUpperCase()}
        </span>
      )}
      <div className={styles.content}>
        {grouped ? null : (
          <div className={styles.meta}>
            <span className={styles.name} style={{ color: nameColor(name) }}>
              {name}
            </span>
            <span className={styles.time}>{time(message.createdAt)}</span>
          </div>
        )}
        {message.replyTo ? (
          <span className={styles.reply}>
            ↳ {message.replyTo.senderName ?? 'Someone'}: {message.replyTo.body}
          </span>
        ) : null}
        {text ? (
          <div className={styles.text}>
            {segments.map((segment, index) =>
              segment.type === 'mention' ? (
                <span key={index} className={styles.mention} data-self={segment.self || undefined}>
                  {segment.text}
                </span>
              ) : (
                <span key={index}>{segment.text}</span>
              ),
            )}
          </div>
        ) : null}
        {embeds.map((embed, index) => (
          <Embed key={index} embed={embed} />
        ))}
        <div className={styles.messageActions}>
          <button
            type="button"
            className={styles.time}
            style={{ background: 'none', border: 0, cursor: 'pointer', padding: '2px 0' }}
            onClick={() => onReply(message)}
          >
            Reply
          </button>
          {(message.reactions ?? []).map((reaction) => (
            <button
              type="button"
              key={reaction.emoji}
              className={styles.reactionBadge}
              aria-pressed={reaction.mine}
              aria-label={`${reaction.emoji}, ${reaction.count} reactions`}
              disabled={!onReact}
              onClick={() => onReact?.(message, reaction.emoji)}
            >
              {reaction.emoji} {reaction.count}
            </button>
          ))}
          {onReact ? (
            <div className={styles.reactionPicker}>
              <button
                type="button"
                className={styles.reactionToggle}
                aria-label={`React to message from ${name}`}
                aria-expanded={reactionsOpen}
                onClick={() => setReactionsOpen((open) => !open)}
              >
                React
              </button>
              {reactionsOpen ? (
                <div className={styles.reactionChoices} role="group" aria-label="Choose a reaction">
                  {REACTION_CHOICES.map((emoji) => (
                    <button
                      type="button"
                      key={emoji}
                      aria-label={`React ${emoji}`}
                      onClick={() => {
                        onReact(message, emoji)
                        setReactionsOpen(false)
                      }}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
